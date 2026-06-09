const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const { verifyAccessToken } = require("../utils/jwtUtils");
const { isVisitante } = require("../utils/authorization");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const VISITANTE_WRITE_EXCEPTIONS = new Set([
    "POST /dashboard/ia/perguntar",
    "POST /relatorios/enviar-agora",
    "POST /auth/logout",
    "DELETE /auth/logout-all"
]);

function getRequestPath(req) {
    const rawUrl = req.originalUrl || req.url || "";
    return String(rawUrl).split("?")[0];
}

function canVisitanteAccess(req) {
    const method = String(req.method || "GET").toUpperCase();

    if (SAFE_METHODS.has(method)) {
        return true;
    }

    const key = `${method} ${getRequestPath(req)}`;
    return VISITANTE_WRITE_EXCEPTIONS.has(key);
}

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next(new AppError("Token não encontrado!", 401));
    };

    try {
        const token = authHeader.split(" ")[1];
        
        const payload = verifyAccessToken(token);

        const usuario = await UsuarioModel.findById(payload.id);

        if(!usuario){
            return next(new AppError("Usuario não encontrado ou não existe mais!", 404));
        };

        if(usuario.role !== payload.role){
            return next(new AppError("Token não atualizado!", 401));
        };
        
        req.usuario = { id: payload.id, role: payload.role };

        if (isVisitante(req.usuario) && !canVisitanteAccess(req)) {
            return next(new AppError("Perfil visitante possui acesso somente leitura.", 403));
        }
        
        return next();
    } catch (error) {
        return next(new AppError("Token não é válido!", 401));
    };
};

module.exports = authMiddleware;
