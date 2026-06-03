function listSummaryValues(values, fallback) {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }

  return values.join(", ");
}

function buildConfirmationSummaryText(confirmation) {
  const summary = confirmation.summary || {};

  if (confirmation.actionName === "criar_agendamento_relatorio") {
    return `Vou criar o agendamento ${summary.nome} para ${listSummaryValues(summary.emailsDestino, "os destinatarios informados")}, com as secoes ${listSummaryValues(summary.secoes, "as secoes informadas")}.`;
  }

  if (confirmation.actionName === "atualizar_agendamento_relatorio") {
    const alteracoes = Array.isArray(summary.alteracoes) && summary.alteracoes.length > 0
      ? summary.alteracoes.join(", ")
      : "os dados informados";

    return `Vou atualizar o agendamento ${summary.id} (${summary.nome}), alterando: ${alteracoes}.`;
  }

  if (confirmation.actionName === "reativar_agendamento_relatorio") {
    return `Vou reativar o agendamento ${summary.id} (${summary.nome}), que hoje esta com status ${summary.statusAtual}.`;
  }

  if (confirmation.actionName === "pausar_agendamento_relatorio") {
    return `Vou pausar o agendamento ${summary.id} (${summary.nome}), que hoje esta com status ${summary.statusAtual}.`;
  }

  if (confirmation.actionName === "deletar_agendamento_relatorio") {
    return `Vou deletar o agendamento ${summary.id} (${summary.nome}) e remover sua configuracao ativa.`;
  }

  if (confirmation.actionName === "executar_agendamento_relatorio_agora") {
    return `Vou executar agora o agendamento ${summary.id} (${summary.nome}) e disparar o envio para os destinatarios configurados.`;
  }

  if (confirmation.actionName === "enviar_relatorio_agora") {
    return `Vou enviar agora o relatorio ${summary.nome || "Relatorio Operacional"} para ${listSummaryValues(summary.emailsDestino, "os destinatarios informados")}, usando as secoes ${listSummaryValues(summary.secoes, "as secoes informadas")}.`;
  }

  if (confirmation.actionName === "criar_manutencao_por_alerta") {
    return `Vou criar uma manutencao para o alerta ${summary.alertaId}${summary.maquinaNome ? ` da maquina ${summary.maquinaNome}` : ""}, com a observacao informada.`;
  }

  if (confirmation.actionName === "atualizar_status_manutencao") {
    return `Vou atualizar a manutencao ${summary.id} do status ${summary.statusAtual} para ${summary.novoStatus}${summary.observacaoNova ? `, com a observacao: ${summary.observacaoNova}` : ""}.`;
  }

  if (confirmation.actionName === "atualizar_limites_sensor") {
    const alteracoes = Array.isArray(summary.alteracoes)
      ? summary.alteracoes
          .map((item) => `${item.campo}: ${item.valorAtual} -> ${item.novoValor}`)
          .join(", ")
      : "os valores informados";

    return `Vou atualizar os limites do sensor ${summary.id}${summary.maquinaNome ? ` da maquina ${summary.maquinaNome}` : ""} com estas alteracoes: ${alteracoes}.`;
  }

  return `Vou executar a acao "${confirmation.actionLabel}".`;
}

module.exports = {
  buildConfirmationSummaryText
};
