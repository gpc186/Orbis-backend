const prisma = require('../prisma/prisma')

class AlertaModel {
    static async create(sensorId, maquinaId, tipo, mensagem) {
        return await prisma.alerta.create({
            data: {
                sensorId,
                maquinaId,
                tipo,
                mensagem,
                status: 'ATIVO'
            }
        })
    }

    static async update(id, data) {
        return await prisma.alerta.update({
            where: { id: parseInt(id) },
            data
        })
    }

    static async findAtivo(sensorId, tipo) {
        return await prisma.alerta.findFirst({
            where: {
                sensorId,
                tipo,
                status: 'ATIVO'
            }
        })
    }

    static async findAll() {
        return await prisma.alerta.findMany({
            include: {
                sensor: true,
                maquina: true,
                tecnico: { select: { nome: true } }
            },
            orderBy: { criadoEm: 'desc' }
        });
    }

    static async countMaquinasWithAlerta() {
        return await prisma.alerta.findMany({
            where: { status: 'ATIVO' },
            select: { maquinaId: true },
            distinct: ['maquinaId']
        }).length
    }

    static async findAlertaStatusOfTecnicoById(id) {
        return await prisma.alerta.findFirst({
            where: {
                tecnicoId: parseInt(id),
                status: 'EM_ANDAMENTO'
            }
        })
    }

    static async findAlertasByTecnico(tecnicoId, { skip, take }) {
        return await prisma.alerta.findMany({
            where: { tecnicoId },
            skip,
            take,
            orderBy: { criadoEm: "desc" },
            select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                ativo: true,
                especialidade: true,
                telefone: true
            }
        });
    }

    static async countActiveAlertas(){
        return await prisma.alerta.count({where: {status: "ATIVO"}});
    };

    static async countAlertasToday(hoje){
        return await prisma.alerta.count({ where: { criadoEm: { gte: hoje } }});
    };

    static async countAlertaSemAtendimento(){
        return await prisma.alerta.count({where: { status: "ATIVO", tecnicoId: null }});
    };

    static async countAtendedToday(hoje){
        return await prisma.alerta.count({ where: { status: "EM_ANDAMENTO", criadoEm: { gte: hoje }} });
    }

    static async countAlertasByTecnicoId(tecnicoId) {
        return await prisma.alerta.count({ where: { tecnicoId } })
    }

    static async findAlertasByTecnico(tecnicoId, { skip, take }) {
        return await prisma.alerta.findMany({
            where: { tecnicoId },
            skip,
            take,
            orderBy: { criadoEm: "desc" },
            include: {
                sensor: true,
                maquina: true,
                tecnico: { select: { nome: true } }
            }
        });
    }
}



module.exports = AlertaModel