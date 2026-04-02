const prisma = require('../prisma/prisma')

class RefreshTokenModel {
    /**
     * Cria um novo refreshToken no banco de dados, ele pega o id do usuário, token novo com informação
     * @param {number} usuarioId 
     * @param {string} token 
     * @param {string} expiresAt
     * @example
     * const tokenNovo = await RefreshTokenModel.create({usuarioId, token, expiresAt});
    */
    static async create({ usuarioId, token, expiresAt}){
        return await prisma.refreshToken.create({ data: {usuarioId, token, expiresAt}});
    };
    /**
     * Acha o refreshToken pelo próprio refreshToken
     * @param {string} token 
     * @example
     * const usuarioPeloToken = await RefreshTokenModel.findByToken(token);
     */
    static async findByToken(token){
        return await prisma.refreshToken.findUnique({ where: {token}});
    };
    /**
     * Pega o refreshToken e deleta ele do banco de dados
     * @param {string} token 
     * @example
     * await RefreshTokenModel.delete(token);
     */
    static async delete(token){
        return await prisma.refreshToken.delete({ where: {token} })
    };
};

module.exports = RefreshTokenModel;