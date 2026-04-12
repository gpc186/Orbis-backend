const MaquinaModel = require('../models/maquinaModel');
const AppError = require("../utils/appErrorUtils")
const prisma = require("../prisma/prisma")

class AlertaService {
    static async gerarAlerta(sensorId, maquinaId, tipo, mensagem) {
        const alertaExistente = await prisma.alerta.findFirst({
            where: {
                sensorId,
                tipo,
                status: 'ATIVO'
            }
        })

        if (alertaExistente) {
            return await prisma.alerta.update({
                where: { id: alertaExistente.id },
                data: {
                    mensagem: `${mensagem} (Ocorrência repetida em ${new Date().toLocaleDateString})`,
                    eventos: {
                        create: { tipo: 'ATUALIZADO', descricao: 'Limite ultrapassado novamente' }
                    }
                }
            })
        }

        const novoAlerta = await prisma.alerta.create({
            data: {
                sensorId,
                maquinaId,
                tipo,
                mensagem,
                status: 'ATIVO'
            }
        })

        console.log(`🚨 NOVO ALERTA [${tipo}]: ${mensagem}`);
        return novoAlerta;
    }
    // TODO: Implementar função no model
    static async countMaquinasWithAlerta() {
        return await prisma.alerta.findMany({
            where: { status: 'ATIVO' },
            select: { maquinaId: true },
            distinct: ['maquinaId']
        }).length
    }
    // TODO: Implementar função no model
    static async countActiveAlertas(){
        return await prisma.alerta.count({where: {status: "ATIVO"}});
    };
    // TODO: Implementar função no model
    static async countAlertasToday(){
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return await prisma.alerta.count({ where: { criadoEm: { gte: hoje } }});
    };
    // TODO: Implementar função no model
    static async countAlertaSemAtendimento(){
        return await prisma.alerta.count({where: { status: "ATIVO", tecnicoId: null }});
    };
    // TODO: Implementar função no model
    static async countAtendedToday(){
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        return await prisma.alerta.count({ where: { status: "EM_ANDAMENTO", criadoEm: { gte: hoje }} });
    }
}

module.exports = AlertaService