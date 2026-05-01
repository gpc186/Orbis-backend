const multer = require("multer");
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
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ mensagem: err.message })
    };

    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                mensagem: "A imagem excede o tamanho máximo permitido de 15MB."
            });
        }

        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                mensagem: "Campo de upload inválido."
            });
        }

        return res.status(400).json({
            mensagem: "Erro no envio do arquivo."
        });
    }

    if (err.code === "P2025") {
        return res.status(404).json({ mensagem: "Registro não encontrado!" });
    };

    if (err.code === "P2002") {
        return res.status(409).json({ mensagem: "registro Já existente!" });
    };

    console.error(err);
    return res.status(500).json({ mensagem: "Erro interno do servidor!" });
};

module.exports = errorMiddleware;