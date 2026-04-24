const { get } = require('node:http');
const AppError = require('../utils/appErrorUtils');

class PredicaoService {
    static calcularHealthScore(sensor) {
        // Pegamos os valores que vieram da leitura atual ou os que já estavam no sensor
        const temp = sensor.temperatura || sensor.ultimaTemperatura || 0;
        const vibra = sensor.vibracao || sensor.ultimaVibracao || 0;

        // Evitar divisão por zero se os limites não estiverem configurados
        const diffTemp = (sensor.limiteTemperatura - sensor.idealTemperatura) || 1;
        const diffVibra = (sensor.limiteVibracao - sensor.idealVibracao) || 1;

        let scoreTemp = 1 - (temp - sensor.idealTemperatura) / diffTemp;
        let scoreVibra = 1 - (vibra - sensor.idealVibracao) / diffVibra;

        // Trava entre 0 e 1
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

            // Passamos os dados atuais para o cálculo
            const scores = maquina.sensores.map(s => this.calcularHealthScore(s));

            // Garante que mediaSaude seja um número válido (0 a 100)
            let mediaSaude = scores.reduce((a, b) => a + b, 0) / scores.length;
            mediaSaude = isNaN(mediaSaude) ? 0 : parseFloat(mediaSaude.toFixed(2));

            console.log(`--- ATUALIZANDO MÁQUINA ${maquinaId} | SCORE: ${mediaSaude} ---`);

            await MaquinaModel.update(maquinaId, { integridade: mediaSaude });

            return mediaSaude;
        } catch (error) {
            throw new AppError("Erro ao atualizar saúde da máquina.", 500);
        }
    }

    static async previsaoManutencao(maquinaId) {
        try {
            const MaquinaModel = require('../models/maquinaModel');
            const LeituraModel = require('../models/leituraModel');

            const maquina = await MaquinaModel.findById(maquinaId);
            const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000); // 2 minutos para teste

            const leituraOntem = await LeituraModel.findUnique(maquinaId, umDiaAtras);

            // Se não houver leitura anterior, não temos como calcular a velocidade de queda
            if (!maquina || !leituraOntem) return null;

            const dadosOntem = { ...leituraOntem.sensor, ...leituraOntem };
            const scoreOntem = this.calcularHealthScore(dadosOntem);
            const scoreHoje = maquina.integridade;

            const quedaPeriodo = scoreOntem - scoreHoje;

            // SÓ calcula se houve queda real e se a saúde atual não é zero
            if (quedaPeriodo <= 0 || scoreHoje <= 0) {
                return await MaquinaModel.update(maquinaId, { previsaoManutencao: null });
            }

            // 1. Data de Falha (0%)
            const tempoAteZero = Math.floor(scoreHoje / quedaPeriodo);
            const dataFalha = new Date();
            dataFalha.setDate(dataFalha.getDate() + tempoAteZero);

            // 2. Janela de Início (70%)
            let ManuInicio = new Date();
            if (scoreHoje > 70) {
                const quedaNecessariaPara70 = scoreHoje - 70;
                const tempoAte70 = Math.floor(quedaNecessariaPara70 / quedaPeriodo);
                ManuInicio.setDate(ManuInicio.getDate() + tempoAte70);
            }

            // 3. Janela de Fim (Data da falha menos 2 dias)
            const ManuFim = new Date(dataFalha.getTime());
            ManuFim.setDate(ManuFim.getDate() - 2);

            console.log(`[PREDIÇÃO] Máquina ${maquinaId}: Falha em ${tempoAteZero}min | Início: ${ManuInicio.toLocaleTimeString()}`);

            return await MaquinaModel.update(maquinaId, {
                previsaoManutencao: dataFalha,
                janelaManuInicio: ManuInicio,
                janelaManuFim: ManuFim
            });
        } catch (error) {
            throw new AppError("Erro ao calcular previsão de manutenção.", 500);
        }
    }
}

module.exports = PredicaoService;