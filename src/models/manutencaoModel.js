const prisma = require("../prisma/prisma");

class ManutecaoModel {
    static async create({ alertaId, usuarioId, observacao, status }) {
        return await prisma.manutencao.create({
            data: alertaId, usuarioId, observacao, status
        });
    };

    static async findAll({ skip, take }) {
        return await prisma.manutencao.findMany({
            skip,
            take,
            include: {
                alerta: true,
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        role: true,
                        telefone: true,
                        especialidade: true
                    }
                }
            }
        });
    };

    static async findByAlertaId(alertaId) {
        return await prisma.manutencao.findMany({
            where: { alertaId: parseInt(alertaId) },
            include: {
                usuario: {
                    select: {
                        id: true,
                        nome: true,
                        email: true,
                        role: true,
                        telefone: true,
                        especialidade: true
                    }
                }
            }
        });
    };

    static async findById(id) {
        return await prisma.manutencao.findUnique({
            where: { id: id }
        });
    };

    static async update({ id, dados }) {
        return await prisma.manutencao.update({
            where: { id: id },
            data: dados
        });
    };

    static async count(){
        return prisma.manutencao.count()
    }
}

module.exports = ManutecaoModel;