const AppError = require("../utils/appErrorUtils");
/**
 * 
 * @param {Error} err 
 * @param {Request} req 
 * @param {Response} res 
 * @param {Next} next 
 * @example
 * router.post('/', errorMiddleware, leituraController.store);
 */
function errorMiddleware(err, req, res, next) {
    if(err instanceof AppError){
        return res.status(err.statusCode).json({ mensagem: err.message})
    };

    if(err.code === "P2025"){
        return res.status(404).json({mensagem: "Registro não encontrado!"});
    };

    if(err.code === "P2002"){
        return res.status(409).json({mensagem: "registro Já existente!"});
    };

    console.error(err);
    return res.status(500).json({mensagem: "Erro interno do servidor!"});
};

module.exports = errorMiddleware;