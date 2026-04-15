const AlertaModel = require('../models/alertaModel')


class AlertaService {
    static async gerarAlerta(sensorId, maquinaId, tipo, mensagem) {

        const alertaExistente = await AlertaModel.findAtivo(sensorId, tipo)
        if (alertaExistente) {
            return await AlertaModel.update(alertaExistente.id, {
                mensagem: `${mensagem} (Ocorrência repetida em ${new Date().toLocaleDateString()})`,
                eventos: {
                    create: { tipo: 'ATUALIZADO', descricao: 'Limite ultrapassado novamente' }
                }
            })
        }

        return await AlertaModel.create(sensorId, maquinaId, tipo, mensagem)

    }
}

module.exports = AlertaService