const AlertaModel = require('../models/alertaModel')
const AppError = require('../utils/appErrorUtils')


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
        try {
            return await AlertaModel.countMaquinasWithAlerta();
        } catch (error) {
            throw new AppError("Erro ao contar máquinas com alerta.", 500);
        }
    }

    static async countActiveAlertas(){
        try {
            return await AlertaModel.countActiveAlertas();
        } catch (error) {
            throw new AppError("Erro ao contar alertas ativos.", 500);
        }
    };

    static async countAlertasToday(){
        try {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            return await AlertaModel.countAlertasToday(hoje);
        } catch (error) {
            throw new AppError("Erro ao contar alertas de hoje.", 500);
        }
    };

    static async countAlertaSemAtendimento(){
        try {
            return await AlertaModel.countAlertaSemAtendimento();
        } catch (error) {
            throw new AppError("Erro ao contar alertas sem atendimento.", 500);
        }
    };

    static async countAtendedToday(){
        try {
            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);
            return await AlertaModel.countAtendedToday(hoje)
        } catch (error) {
            throw new AppError("Erro ao contar alertas atendidos hoje.", 500);
        }
    }

    static async findAll(){
        return await AlertaModel.findAll();
    }

    static async findById(id){
        try {
            const alerta = await AlertaModel.findById(id);
            if (!alerta) throw new AppError("Alerta não encontrada.", 404);
            return alerta;
        } catch (error) {
            throw new AppError("Erro ao buscar alerta.", 500);
        }
    }
}

module.exports = AlertaService