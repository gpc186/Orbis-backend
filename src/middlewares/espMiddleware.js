const AppError = require("../utils/appErrorUtils");

function espMiddleware(req, res, next) {
    const apiKey = req.headers["x-api-key"]

    if (!apiKey) {
        next(new AppError("Token não encontrado!", 401));
    };

    if (apiKey != process.env.ESP32_API_KEY) {
        next(new AppError("key não é válido!", 401))
    }

    next();
};

module.exports = espMiddleware;