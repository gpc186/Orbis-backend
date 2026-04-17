const LeituraModel = require('../models/leituraModel')
const MaquinaModel = require('../models/maquinaModel')

class PredicaoService {
    static async calcularHealthScore(sensor) {
        const { ultimaTemperatura, ultimaVibracao, limiteTemperatura, limiteVibracao, idealTemperatura, idealVibracao } = sensor

        let scoreTemp = 1 - (ultimaTemperatura - idealTemperatura) / (limiteTemperatura - idealTemperatura)
        let scoreVibra = 1 - (ultimaVibracao - idealVibracao) / (limiteVibracao - idealVibracao)

        scoreTemp = Math.max(0, Math.min(1, scoreTemp))
        scoreVibra = Math.max(0, Math.min(1, scoreVibra))

        const pesoTemp = 0.4
        const pesoVibra = 0.6

        let healthScoreFinal = ((scoreTemp * pesoTemp) + (scoreVibra * pesoVibra)) * 100

        return parseFloat(healthScoreFinal.toFixed(2))
    }

    static async atualizarSaudeMaquina(maquinaId) {
        const maquina = await MaquinaModel.findById(maquinaId, { include: { sensores: true } })

        // Se a máquina não existir ou não tiver sensores, definimos integridade como 100 ou 0
        if (!maquina || !maquina.sensores || maquina.sensores.length === 0) {
            await MaquinaModel.update(maquinaId, { integridade: 100 });
            return 100;
        }

        const scores = maquina.sensores.map(s => this.calcularHealthScore(s))
        const mediaSaude = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))

        await MaquinaModel.update(maquinaId, { integridade: mediaSaude })

        return mediaSaude
    }

    static async previsaoManutencao(maquinaId) {
        const maquina = await MaquinaModel.findById(maquinaId)
        const umDiaAtras = new Date(Date.now() - 24 * 60 * 60 * 1000)

        const leituraOntem = await LeituraModel.findUnique(maquinaId, umDiaAtras)

        if(!maquina || ! leituraOntem) return null

        const dadosOntem = {...leituraOntem.sensor, ...leituraOntem}
        const scoreOntem = this.calcularHealthScore(dadosOntem)
        const scoreHoje = maquina.integridade

        const quedaUltimas24h = scoreOntem - scoreHoje
        if (quedaUltimas24h <= 0) {
            return await MaquinaModel.update(maquinaId, {previsaoManutencao: null})
        }
        const diasRestantes = Math.floor(scoreHoje / quedaUltimas24h)
        const dataPrevisao = new Date()
        dataPrevisao.setDate(dataPrevisao.getDate() + diasRestantes)

        return await MaquinaModel.update(maquinaId, {previsaoManutencao: dataPrevisao})
    }
}