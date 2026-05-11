const AppError = require("../utils/appErrorUtils");
const { validateContactPayload } = require("../utils/contactValidation");

function validateContactMiddleware(req, _res, next) {
  const result = validateContactPayload(req.body);

  if (!result.ok) {
    return next(new AppError(result.message, result.status));
  }

  req.body = result.data; // body já normalizado
  return next();
}

module.exports = validateContactMiddleware;