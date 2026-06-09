const AppError = require("../../utils/appErrorUtils");
const {
  assertRole,
  ADMIN_READ_ROLES,
  ADMIN_WRITE_ROLES,
  ROLES
} = require("../../utils/authorization");

const WRITE_TOOL_NAMES = new Set([
  "criar_agendamento_relatorio",
  "atualizar_agendamento_relatorio",
  "reativar_agendamento_relatorio",
  "pausar_agendamento_relatorio",
  "deletar_agendamento_relatorio",
  "executar_agendamento_relatorio_agora",
  "enviar_relatorio_agora",
  "criar_manutencao_por_alerta",
  "atualizar_status_manutencao",
  "atualizar_limites_sensor"
]);

const ADMIN_WRITE_TOOL_NAMES = new Set([
  "criar_agendamento_relatorio",
  "atualizar_agendamento_relatorio",
  "reativar_agendamento_relatorio",
  "pausar_agendamento_relatorio",
  "deletar_agendamento_relatorio",
  "executar_agendamento_relatorio_agora",
  "enviar_relatorio_agora",
  "atualizar_limites_sensor"
]);

function isWriteTool(name) {
  return WRITE_TOOL_NAMES.has(name);
}

function assertReadToolPermission(usuario) {
  assertRole({
    usuario,
    roles: ADMIN_READ_ROLES,
    message: "Usuario sem permissao para usar tools administrativas."
  });
}

function assertWriteToolPermission({ name, usuario }) {
  if (!usuario) {
    throw new AppError("Usuario sem permissao para usar tools administrativas.", 403);
  }

  if (ADMIN_WRITE_TOOL_NAMES.has(name)) {
    assertRole({
      usuario,
      roles: ADMIN_WRITE_ROLES,
      message: "Usuario sem permissao para usar tools administrativas."
    });
    return;
  }

  if (name === "criar_manutencao_por_alerta") {
    assertRole({
      usuario,
      roles: [ROLES.ADMIN, ROLES.TECNICO],
      message: "Usuario sem permissao para criar manutencao."
    });
    return;
  }

  if (name === "atualizar_status_manutencao") {
    assertRole({
      usuario,
      roles: [ROLES.TECNICO],
      message: "Apenas o tecnico responsavel pode atualizar a manutencao."
    });
  }
}

module.exports = {
  isWriteTool,
  assertReadToolPermission,
  assertWriteToolPermission
};
