const AppError = require("../utils/appErrorUtils")

function roleMiddleware(...roles){
    return (req, res, next) =>{
        const userRole = req.usuario.role;

        if(!roles.includes(userRole)){
            return next(new AppError("Credenciais inválidas!", 403))
        };

        return next();
    };
};

module.exports = roleMiddleware;