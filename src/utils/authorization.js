const AppError = require("./appErrorUtils");

function assertRole({ usuario, roles, message = "Credenciais invalidas!" }) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!usuario || !allowedRoles.includes(usuario.role)) {
    throw new AppError(message, 403);
  }
}

module.exports = {
  assertRole
};
