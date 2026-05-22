const { SimpleLinearRegression } = require('ml-regression-simple-linear');
const AppError = require('../utils/appErrorUtils');

class PredicaoService {
    static MIN_PONTOS_REGRESSAO = 8;
    static LIMITE_PONTOS_REGRESSAO = 30;
    static R2_MINIMO = 0.6;
    static LIMIAR_MANUTENCAO = 70;
    static LIMIAR_FALHA = 30;
    static LIMITE_MAXIMO_DIAS_PREVISAO = 90;
    static DIAS_ANTECEDENCIA_FIM_JANELA = 2;

    static calcularHealthScore(sensor) {
        const temp = sensor.temperatura || sensor.ultimaTemperatura || 0;
        const vibra = sensor.vibracao || sensor.ultimaVibracao || 0;

        const diffTemp = (sensor.limiteTemperatura - sensor.idealTemperatura) || 1;
        const diffVibra = (sensor.limiteVibracao - sensor.idealVibracao) || 1;

        let scoreTemp = 1 - (temp - sensor.idealTemperatura) / diffTemp;
        let scoreVibra = 1 - (vibra - sensor.idealVibracao) / diffVibra;

        scoreTemp = Math.max(0, Math.min(1, scoreTemp));
        scoreVibra = Math.max(0, Math.min(1, scoreVibra));

        const total = ((scoreTemp * 0.4) + (scoreVibra * 0.6)) * 100;
        return parseFloat(total.toFixed(2)) || 0;
    }

    static async atualizarSaudeMaquina(maquinaId) {
        try {
            const MaquinaModel = require('../models/maquinaModel');
            const maquina = await MaquinaModel.findById(maquinaId, { include: { sensores: true } });

            if (!maquina || !maquina.sensores || maquina.sensores.length === 0) return 100;

            const scores = maquina.sensores.map((sensor) => this.calcularHealthScore(sensor));

            let mediaSaude = scores.reduce((a, b) => a + b, 0) / scores.length;
            mediaSaude = isNaN(mediaSaude) ? 0 : parseFloat(mediaSaude.toFixed(2));

            console.log(`--- ATUALIZANDO MAQUINA ${maquinaId} | SCORE: ${mediaSaude} ---`);

            await MaquinaModel.update(maquinaId, { integridade: mediaSaude });

            return mediaSaude;
        } catch (error) {
            throw new AppError("Erro ao atualizar saude da maquina.", 500);
        }
    }

    static criarPontosRegressao(historico) {
        if (!historico.length) return [];

        const dataBase = new Date(historico[0].criadoEm);

        return historico.map((registro) => ({
            x: (new Date(registro.criadoEm).getTime() - dataBase.getTime()) / (1000 * 60 * 60),
            y: Number(registro.integridade),
            criadoEm: new Date(registro.criadoEm)
        }));
    }

    static criarModeloRegressao(pontos) {
        if (pontos.length < 2) return null;

        const x = pontos.map((ponto) => ponto.x);
        const y = pontos.map((ponto) => ponto.y);
        const modelo = new SimpleLinearRegression(x, y);
        const score = modelo.score(x, y);

        return {
            modelo,
            score,
            slope: modelo.slope,
            intercept: modelo.intercept
        };
    }

    static projetarDataLimiar(regressao, limiar, dataBase) {
        if (!regressao || regressao.slope >= 0) return null;

        const horasAteLimiar = regressao.modelo.computeX(limiar);

        if (!Number.isFinite(horasAteLimiar) || horasAteLimiar <= 0) {
            return null;
        }

        if (horasAteLimiar > (this.LIMITE_MAXIMO_DIAS_PREVISAO * 24)) {
            return null;
        }

        return new Date(dataBase.getTime() + (horasAteLimiar * 60 * 60 * 1000));
    }

    static async limparPrevisao(maquinaId, MaquinaModel) {
        return await MaquinaModel.update(maquinaId, {
            previsaoManutencao: null,
            janelaManuInicio: null,
            janelaManuFim: null
        });
    }

    static obterReferenciaTemporal(pontos) {
        const ultimoPonto = pontos[pontos.length - 1]?.criadoEm;
        const agora = new Date();

        if (!ultimoPonto) {
            return agora;
        }

        return ultimoPonto > agora ? ultimoPonto : agora;
    }

    static async obterModeloIntegridade(maquinaId) {
        const HistoricoIntegridadeModel = require('../models/historicoIntegridadeModel');

        const historico = await HistoricoIntegridadeModel.findSerieByMaquina(maquinaId, {
            limite: this.LIMITE_PONTOS_REGRESSAO
        });

        if (historico.length < this.MIN_PONTOS_REGRESSAO) {
            return {
                disponivel: false,
                valido: false,
                motivo: "historico_insuficiente",
                modeloIntegridade: null
            };
        }

        const pontos = this.criarPontosRegressao(historico);
        const regressao = this.criarModeloRegressao(pontos);

        if (!regressao) {
            return {
                disponivel: false,
                valido: false,
                motivo: "modelo_nao_pode_ser_calculado",
                modeloIntegridade: null
            };
        }

        const modeloIntegridade = {
            modelo: regressao.modelo,
            score: regressao.score,
            slope: regressao.slope,
            intercept: regressao.intercept,
            dataBase: pontos[0].criadoEm,
            referenciaTemporal: this.obterReferenciaTemporal(pontos),
            pontosUsados: pontos.length
        };

        const valido = modeloIntegridade.slope < 0 && modeloIntegridade.score.r2 >= this.R2_MINIMO;

        return {
            disponivel: true,
            valido,
            motivo: valido ? null : "tendencia_nao_confiavel",
            modeloIntegridade
        };
    }

    static async previsaoManutencao(maquinaId) {
        try {
            const MaquinaModel = require('../models/maquinaModel');

            const maquina = await MaquinaModel.findById(maquinaId);
            if (!maquina) return null;

            const resultadoModelo = await this.obterModeloIntegridade(maquinaId);
            if (!resultadoModelo.disponivel || !resultadoModelo.valido || !resultadoModelo.modeloIntegridade) {
                return await this.limparPrevisao(maquinaId, MaquinaModel);
            }

            const regressao = resultadoModelo.modeloIntegridade;
            const dataBase = regressao.dataBase;
            const referenciaTemporal = regressao.referenciaTemporal;
            const dataInicioManutencao = this.projetarDataLimiar(
                regressao,
                this.LIMIAR_MANUTENCAO,
                dataBase
            );
            const dataFalha = this.projetarDataLimiar(
                regressao,
                this.LIMIAR_FALHA,
                dataBase
            );

            if (!dataFalha || dataFalha <= referenciaTemporal) {
                return await this.limparPrevisao(maquinaId, MaquinaModel);
            }

            let janelaManuInicio = dataInicioManutencao;
            if (!janelaManuInicio || janelaManuInicio < referenciaTemporal) {
                janelaManuInicio = new Date(referenciaTemporal.getTime());
            }

            let janelaManuFim = new Date(dataFalha.getTime());
            janelaManuFim.setDate(janelaManuFim.getDate() - this.DIAS_ANTECEDENCIA_FIM_JANELA);

            if (janelaManuFim < referenciaTemporal) {
                janelaManuFim = new Date(referenciaTemporal.getTime());
            }

            if (janelaManuInicio > janelaManuFim) {
                janelaManuFim = new Date(janelaManuInicio.getTime());
            }

            console.log(
                `[PREDICAO] Maquina ${maquinaId}: inclinacao=${regressao.slope.toFixed(4)} ` +
                `intercepto=${regressao.intercept.toFixed(4)} ` +
                `r2=${regressao.score.r2.toFixed(4)} falha=${dataFalha.toISOString()}`
            );

            return await MaquinaModel.update(maquinaId, {
                previsaoManutencao: dataFalha,
                janelaManuInicio,
                janelaManuFim
            });
        } catch (error) {
            throw new AppError("Erro ao calcular previsao de manutencao.", 500);
        }
    }
}

module.exports = PredicaoService;
