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

    static async countMaquinasWithAlerta() {
        return await AlertaModel.countMaquinasWithAlerta();
    }

    static async countActiveAlertas(){
        return await AlertaModel.countActiveAlertas();
    };

    static async countAlertasToday(){
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return await AlertaModel.countAlertasToday(hoje);
    };

    static async countAlertaSemAtendimento(){
        return await AlertaModel.countAlertaSemAtendimento();
    };

    static async countAtendedToday(){
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return await AlertaModel.countAtendedToday(hoje)
    }

    static async findAll(){
        return await AlertaModel.findAll();
    }

    static async findById(id){
        return await AlertaModel.findById(id);
    }
}

module.exports = AlertaService