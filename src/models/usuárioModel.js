const prisma = require("../prisma/prisma");

class UsuarioModel {
    static async create({ nome, email, senha, role }) {
        return await prisma.usuario.create({ data: { nome, email, senha, role }, omit: { senha: true } });
    };

    static async findByEmail(email) {
        return await prisma.usuario.findUnique({ where: { email } });
    };

    static async findById(id) {
        return await prisma.usuario.findUnique({ where: { id }, omit: { senha: true } })
    };

    static async findAll(skip, take) {
        return await prisma.usuario.findMany({
            where: { ativo: true },
            skip,
            take,
            orderBy: { criadoEm: "desc" },
            omit: { senha: true }
        });
    };

    static async update({ id, dados }) {
        return await prisma.usuario.update({ where: { id }, data: dados, omit: { senha: true } });
    };

    static async delete({ id }) {
        return await prisma.usuario.delete({ where: { id } });
    };

    static async countAdmins() {
        return await prisma.usuario.count({where: { role: "ADMIN", ativo: true }, omit: {senha: true}});
    };
};

module.exports = UsuarioModel;