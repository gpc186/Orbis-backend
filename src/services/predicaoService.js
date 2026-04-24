const AppError = require('../utils/appErrorUtils');

class PredicaoService {
    static async calcularHealthScore(sensor) {
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
            const umDiaAtras = new Date(Date.now() - 2 * 60 * 1000); // 2 minutos para teste

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

            const tempoRestante = Math.floor(scoreHoje / quedaPeriodo);

            // Proteção: se o cálculo der um número absurdo, ignoramos
            if (!isFinite(tempoRestante) || isNaN(tempoRestante)) {
                return await MaquinaModel.update(maquinaId, { previsaoManutencao: null });
            }

            const dataPrevisao = new Date();
            // No teste estamos usando Minutos. No real, mude para setDate
            dataPrevisao.setMinutes(dataPrevisao.getMinutes() + tempoRestante);

            // Validação extra antes de enviar ao Prisma
            if (isNaN(dataPrevisao.getTime())) {
                return await MaquinaModel.update(maquinaId, { previsaoManutencao: null });
            }

            return await MaquinaModel.update(maquinaId, { previsaoManutencao: dataPrevisao });
        } catch (error) {
            throw new AppError("Erro ao calcular previsão de manutenção.", 500);
        }
    }
}

module.exports = PredicaoService;