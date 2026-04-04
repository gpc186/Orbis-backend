const AppError = require("../utils/appErrorUtils")

function roleMiddleware(...roles){
    return (req, res, next) =>{
        const userRole = req.usuario.role;

        if(!roles.includes(userRole)){
            next(new AppError("Credenciais inválidas!", 403))
        };

        next();
    };
};

module.exports = roleMiddleware;