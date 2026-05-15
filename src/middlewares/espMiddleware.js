const AppError = require("../utils/appErrorUtils");

function espMiddleware(req, res, next) {
    const apiKey = req.headers["x-api-key"];

    if (!apiKey) {
        return next(new AppError("Token nao encontrado!", 401));
    }

    if (apiKey !== process.env.ESP32_API_KEY) {
        return next(new AppError("key nao e valido!", 401));
    }

    return next();
}

module.exports = espMiddleware;
