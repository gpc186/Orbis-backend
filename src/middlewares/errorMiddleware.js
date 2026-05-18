const multer = require("multer");
const AppError = require("../utils/appErrorUtils");
const logger = require("../utils/logger");

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
  const requestId = req.requestId || res.locals.requestId || null;

  if (err instanceof AppError) {
    logger.warn("request_error", {
      requestId,
      statusCode: err.statusCode,
      error: err
    });

    return res.status(err.statusCode).json({
      mensagem: err.message,
      requestId
    });
  }

  if (err instanceof multer.MulterError) {
    logger.warn("request_error", {
      requestId,
      statusCode: 400,
      error: err
    });

    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        mensagem: "A imagem excede o tamanho maximo permitido de 15MB.",
        requestId
      });
    }

    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        mensagem: "Campo de upload invalido.",
        requestId
      });
    }

    return res.status(400).json({
      mensagem: "Erro no envio do arquivo.",
      requestId
    });
  }

  if (err.code === "P2025") {
    logger.warn("request_error", {
      requestId,
      statusCode: 404,
      error: err
    });

    return res.status(404).json({
      mensagem: "Registro nao encontrado!",
      requestId
    });
  }

  if (err.code === "P2002") {
    logger.warn("request_error", {
      requestId,
      statusCode: 409,
      error: err
    });

    return res.status(409).json({
      mensagem: "Registro ja existente!",
      requestId
    });
  }

  logger.error("request_error", {
    requestId,
    statusCode: 500,
    error: err
  });

  return res.status(500).json({
    mensagem: "Erro interno do servidor!",
    requestId
  });
}

module.exports = errorMiddleware;
