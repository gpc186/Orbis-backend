const prisma = require("../prisma/prisma");

class UsuarioModel {
    /**
     * Uma função que pega os parametros necessários para criar uma conta e salva no banco de dados
     * @typedef {Object} Usuario
     * @param {string} nome
     * @param {string} email
     * @param {string} senha
     * @param {string} role
     * @returns  Todos os dados anteriores, menos a senha
     * @example
     * const usuarioNovo = await UsuarioModel.create({nome, email, senha, role});
     */
    static async create({ nome, email, senha, role }) {
        return await prisma.usuario.create({
            data: { nome, email, senha, role }, select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                ativo: true,
                especialidade: true,
                telefone: true,
                oneSignalId: true,
                atualizadoEm: true,
                criadoEm: true
            }
        });
    };
    /**
     * Pega os dados de um usuário pelo e-mail, normalmente usado no login
     * @param {string} email 
     * @returns  Todos os dados do usuário
     * @example
     * const usuario = await UsuarioModel.findByEmail(email)
     */
    static async findByEmail(email) {
        return await prisma.usuario.findUnique({ where: { email } });
    };
    /**
     * Pega os dados de usuário pelo id dele, normalmente usado em requisições de api
     * @param {number} id 
     * @returns  Todos os dados do usuário, menos a senha
     * @example
     * const usuario = await UsuarioModel.findById(id);
     */
    static async findById(id) {
        return await prisma.usuario.findUnique({
            where: { id }, select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                ativo: true,
                especialidade: true,
                telefone: true,
                oneSignalId: true,
                atualizadoEm: true,
                criadoEm: true
            }
        })
    };
    /**
     * Pega todos os usuários que estão ativos com uma função de paginação, tendo o `skip`e `take` para fazer esta função
     * @param {number} skip 
     * @param {number} take 
     * @returns  Todos os usuários e seus dados, apenas removendo a senha
     * @example
     * const todosUsuarios = await UsuarioModel.findAll(skip, take);
     */
    static async findAll(skip, take) {
        return await prisma.usuario.findMany({
            where: { ativo: true },
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
    };
    /**
     * Atualiza campos requisitados pelo service no banco de dados
     * @param {number} id
     * @param {string} nome
     * @param {string} role
     * @param {string} especialidade
     * @param {string} dados
     * @throws {Error}
     * @returns Todos os dados do usuário, menos a senha
     * @example
     * const dadosNovos = await UsuarioModel.update( id,{ nome, role, especialidade, telefone });
     */
    static async update(id, { nome, role, especialidade, telefone }) {
        return await prisma.usuario.update({
            where: { id }, data: { nome, role, especialidade, telefone }, select: {
                id: true,
                nome: true,
                email: true,
                role: true,
                ativo: true,
                especialidade: true,
                telefone: true,
                oneSignalId: true,
                atualizadoEm: true,
                criadoEm: true
            }
        });
    };
    /**
     * Deleta um usuario pelo seu ID
     * @param {number} id
     * @example
     * await UsuarioModel.delete(id)
     */
    static async delete(id) {
        return await prisma.usuario.delete({ where: { id } });
    };
    /**
     * Retorna a quantidade de usuarios cadastrados, serve para a paginação
     * @returns  O numero de usuários
     * @example
     * const quantidadeUsuarios = await UsuarioModel.count();
     */
    static async count() {
        return await prisma.usuario.count()
    }
    /**
     * Pega o numero de Admins, isso é pela regra de negócio para sempre ter pelo menos `um admin ativo sempre`
     * @returns  O numero de admins
     * @example
     * const adminCount = await UsuarioModel.countAdmins();
     * 
     * if(adminCount <= 1){
     *  throw new AppError("Não é possivel deletar o ultimo admin", 409)
     * }
     */
    static async countAdmins() {
        return await prisma.usuario.count({
            where: { role: "ADMIN", ativo: true }
        });
    };
};

module.exports = UsuarioModel;