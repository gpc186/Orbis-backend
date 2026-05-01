const UsuarioModel = require("../models/usuarioModel");
const AppError = require("../utils/appErrorUtils");
const { verifyAccessToken } = require("../utils/jwtUtils");

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
        
        return next();
    } catch (error) {
        return next(new AppError("Token não é válido!", 401));
    };
};

module.exports = authMiddleware;
