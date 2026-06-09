const AppError = require("./appErrorUtils");

const ROLES = {
  ADMIN: "ADMIN",
  TECNICO: "TECNICO",
  VISITANTE: "VISITANTE"
};

const ADMIN_READ_ROLES = [ROLES.ADMIN, ROLES.VISITANTE];
const ADMIN_WRITE_ROLES = [ROLES.ADMIN];
const TECH_WRITE_ROLES = [ROLES.TECNICO];
const AUTHENTICATED_OPERATION_ROLES = [ROLES.ADMIN, ROLES.TECNICO, ROLES.VISITANTE];

function assertRole({ usuario, roles, message = "Credenciais invalidas!" }) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!usuario || !allowedRoles.includes(usuario.role)) {
    throw new AppError(message, 403);
  }
}

function assertAdminRead(usuario, message = "Credenciais invalidas!") {
  assertRole({ usuario, roles: ADMIN_READ_ROLES, message });
}

function assertAdminWrite(usuario, message = "Credenciais invalidas!") {
  assertRole({ usuario, roles: ADMIN_WRITE_ROLES, message });
}

function isVisitante(usuario) {
  return usuario?.role === ROLES.VISITANTE;
}

function isValidUserRole(role) {
  return AUTHENTICATED_OPERATION_ROLES.includes(role);
}

module.exports = {
  ROLES,
  ADMIN_READ_ROLES,
  ADMIN_WRITE_ROLES,
  TECH_WRITE_ROLES,
  AUTHENTICATED_OPERATION_ROLES,
  assertRole,
  assertAdminRead,
  assertAdminWrite,
  isVisitante,
  isValidUserRole
};
