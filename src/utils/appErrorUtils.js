/**
 * Pega o `Error()` e coloca um status imbutido para melhor DX
 * @param {string} mensagem
 * @param {number} statusCode
 * @example 
 * if(usuario.role !== "ADMIN"){
 *    throw new AppError("Você não tem permissão para entrar!", 403);
 * }
 */
class AppError extends Error {
    constructor(mensagem, statusCode){
        super(mensagem),
        this.name = "AppError"
        this.statusCode = statusCode

        Error.captureStackTrace?.(this, this.constructor);
    }
}

module.exports = AppError