const AppError = require("../utils/appErrorUtils");
const { verifyAccessToken } = require("../utils/jwtUtils");

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next(new AppError("Token não encontrado!", 401));
    };

    try {
        const token = authHeader.split(" ")[1];
        
        const user = verifyAccessToken(token);
        
        req.usuario = { id: user.id, role: user.role };
        
        return next();
    } catch (error) {
        return next(new AppError("Token não é válido!", 401));
    };
};

module.exports = authMiddleware;