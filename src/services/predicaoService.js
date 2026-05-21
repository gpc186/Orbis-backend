const { SimpleLinearRegression } = require('ml-regression-simple-linear');
const AppError = require('../utils/appErrorUtils');

class PredicaoService {
    static MIN_PONTOS_REGRESSAO = 8;
    static LIMITE_PONTOS_REGRESSAO = 30;
    static R2_MINIMO = 0.6;
    static LIMIAR_MANUTENCAO = 70;
    static LIMIAR_FALHA = 30;
    static LIMITE_MAXIMO_DIAS_PREVISAO = 90;

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

    static async previsaoManutencao(maquinaId) {
        try {
            const MaquinaModel = require('../models/maquinaModel');
            const HistoricoIntegridadeModel = require('../models/historicoIntegridadeModel');

            const maquina = await MaquinaModel.findById(maquinaId);
            if (!maquina) return null;

            const historico = await HistoricoIntegridadeModel.findSerieByMaquina(maquinaId, {
                limite: this.LIMITE_PONTOS_REGRESSAO
            });

            if (historico.length < this.MIN_PONTOS_REGRESSAO) {
                return await this.limparPrevisao(maquinaId, MaquinaModel);
            }

            const pontos = this.criarPontosRegressao(historico);
            const regressao = this.criarModeloRegressao(pontos);

            if (!regressao || regressao.slope >= 0 || regressao.score.r2 < this.R2_MINIMO) {
                return await this.limparPrevisao(maquinaId, MaquinaModel);
            }

            const dataBase = pontos[0].criadoEm;
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

            if (!dataFalha) {
                return await this.limparPrevisao(maquinaId, MaquinaModel);
            }

            const janelaManuInicio = dataInicioManutencao && dataInicioManutencao < dataFalha
                ? dataInicioManutencao
                : null;

            console.log(
                `[PREDICAO] Maquina ${maquinaId}: inclinacao=${regressao.slope.toFixed(4)} ` +
                `intercepto=${regressao.intercept.toFixed(4)} ` +
                `r2=${regressao.score.r2.toFixed(4)} falha=${dataFalha.toISOString()}`
            );

            return await MaquinaModel.update(maquinaId, {
                previsaoManutencao: dataFalha,
                janelaManuInicio,
                janelaManuFim: dataFalha
            });
        } catch (error) {
            throw new AppError("Erro ao calcular previsao de manutencao.", 500);
        }
    }
}

module.exports = PredicaoService;
