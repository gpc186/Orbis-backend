const jwt = require('jsonwebtoken');
const crypto = require('crypto');
/**
 * Função helper para criar o `accessToken`
 * @param {number} id 
 * @param {string} role
 * @returns O token com o `JWT_SECRET` e `JWT_EXPIRES_IN` do `.env`
 * @example
 * const accessToken = generateAccessToken({ id: usuario.id, role: usuario.role });
 */
function generateAccessToken({ id, role }) {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
};
/**
 * Verifica o `accessToken`, caso seja valido, retorna o jwt `decoded`, com todas as informações do jwt
 * @param {string} token 
 * @returns O token decodificado caso seja válido
 * @example
 * const dadosJwt = verifyAccessToken(token);
 */
function verifyAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
};
/**
 * função helper para gerar dados para a crição do `refreshToken`
 * @returns `token` e `expiresAt`
 * @example
 * const { token, expiresAt } = generateRefreshTokenData()
 */
function generateRefreshTokenData() {
    const token = crypto.randomBytes(64).toString('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS));

    return { token, expiresAt }
}

module.exports = { generateAccessToken, verifyAccessToken, generateRefreshTokenData }