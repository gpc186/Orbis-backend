const prisma = require('../prisma/prisma')

class AlertaModel {
    static async create(sensorId, maquinaId, tipo, mensagem) {
        return await prisma.$transaction(async (tx) => {
            const alerta = await tx.alerta.create({
                data: {
                    sensorId,
                    maquinaId,
                    tipo,
                    mensagem,
                    status: 'ATIVO'
                }
            });

            await tx.alertaEvento.create({
                data: {
                    alertaId: alerta.id,
                    tipo: 'CRIADO',
                    statusNovo: 'ATIVO',
                    mensagem,
                    descricao: 'Alerta criado automaticamente'
                }
            });

            return alerta;
        });
    }

    static async update(id, data) {
        return await prisma.alerta.update({
            where: { id: parseInt(id) },
            data
        })
    }

    static async findById(id) {
        return await prisma.alerta.findFirst({ where: { id: parseInt(id) } });
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

    static async findById(id) {
        return await prisma.alerta.findUnique({
            where: { id: parseInt(id) },
            include: {
                sensor: true,
                maquina: true,
                tecnico: { select: { nome: true } },
                eventos: {
                    include: {
                        usuario: { select: { id: true, nome: true, email: true, role: true } },
                        manutencao: true
                    },
                    orderBy: { criadoEm: 'desc' }
                },
                manutencoes: true
            }
        });
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
        const alerta = await prisma.alerta.findMany({
            where: { status: 'ATIVO' },
            select: { maquinaId: true },
            distinct: ['maquinaId']
        })
        return alerta.length
    }

    static async listTopAtivos({ limit = 5 } = {}) {
        const safeLimit = Number(limit) > 0 ? Number(limit) : 5;

        return prisma.alerta.findMany({
            where: { status: "ATIVO" },
            orderBy: { criadoEm: "desc" }, // ajuste para o nome real da sua coluna de data
            take: safeLimit,
            select: {
                id: true,
                tipo: true,
                status: true,
                maquinaId: true,
                sensorId: true,
                criadoEm: true,
                maquina: {
                    select: {
                        id: true,
                        nome: true,
                        criticidade: true
                    }
                }
            }
        });
    }

    static async findAlertaStatusOfTecnicoById(id) {
        return await prisma.alerta.findFirst({
            where: {
                tecnicoId: parseInt(id),
                status: 'EM_ANDAMENTO'
            }
        })
    }

    static async countActiveAlertas() {
        return await prisma.alerta.count({ where: { status: "ATIVO" } });
    };

    static async countAlertasToday(hoje) {
        return await prisma.alerta.count({ where: { criadoEm: { gte: hoje } } });
    };

    static async countAlertaSemAtendimento() {
        return await prisma.alerta.count({ where: { status: "ATIVO", tecnicoId: null } });
    };

    static async countAtendedToday(hoje) {
        return await prisma.alerta.count({ where: { status: "EM_ANDAMENTO", criadoEm: { gte: hoje } } });
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
