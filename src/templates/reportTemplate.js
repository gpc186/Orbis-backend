function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  if (value == null) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildSummaryCards(resumo = {}) {
  const cards = [
    ["Maquinas", resumo.totalMaquinas ?? 0],
    ["Em alerta", resumo.maquinasEmAlerta ?? 0],
    ["Alertas ativos", resumo.alertasAtivos ?? 0],
    ["Sem atendimento", resumo.alertaSemAtendimento ?? 0]
  ];

  return cards
    .map(
      ([label, value]) => `
        <td style="padding: 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;">
            <tr>
              <td style="padding: 14px;">
                <div style="font-size: 11px; text-transform: uppercase; color: #6b7280;">${escapeHtml(label)}</div>
                <div style="font-size: 24px; font-weight: 700; color: #111827; margin-top: 6px;">${escapeHtml(value)}</div>
              </td>
            </tr>
          </table>
        </td>
      `
    )
    .join("");
}

function buildMachineRows(maquinas = []) {
  if (!maquinas.length) {
    return `
      <tr>
        <td colspan="5" style="padding: 12px; color: #6b7280; text-align: center;">
          Nenhuma maquina encontrada para os filtros selecionados.
        </td>
      </tr>
    `;
  }

  return maquinas
    .slice(0, 15)
    .map(
      (maquina) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(maquina.nome || "-")}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(maquina.setor || "-")}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(maquina.tipo || "-")}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(maquina.criticidade || "-")}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(maquina.integridade ?? 0)}%</td>
        </tr>
      `
    )
    .join("");
}

function buildAlertRows(alertas = []) {
  if (!alertas.length) {
    return `
      <tr>
        <td colspan="5" style="padding: 12px; color: #6b7280; text-align: center;">
          Nenhum alerta encontrado no periodo selecionado.
        </td>
      </tr>
    `;
  }

  return alertas
    .slice(0, 10)
    .map(
      (alerta) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(alerta.maquina?.nome || alerta.maquinaNome || "-")}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(alerta.sensor?.tipo || alerta.sensorTipo || "-")}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(alerta.tipo || "-")}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(alerta.status || "-")}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">${escapeHtml(formatDateTime(alerta.criadoEm || alerta.createdAt))}</td>
        </tr>
      `
    )
    .join("");
}

function gerarRelatorioHTML({ resumo, maquinas = [], alertas = [], config = {} }) {
  const periodoLabel = config.periodoLabel || "30 dias";
  const geradoEm = formatDateTime(new Date());

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Relatorio Operacional Orbis</title>
    </head>
    <body style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, Helvetica, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 0;">
        <tr>
          <td align="center">
            <table width="760" cellpadding="0" cellspacing="0" border="0" style="max-width:760px; width:100%; background:#ffffff; border:1px solid #e5e7eb;">
              <tr>
                <td style="padding:24px 28px; border-bottom:3px solid #2563eb;">
                  <div style="font-size:26px; font-weight:700; color:#111827;">Orbis</div>
                  <div style="font-size:13px; color:#6b7280; margin-top:8px;">Relatorio operacional automatico</div>
                  <div style="font-size:12px; color:#6b7280; margin-top:4px;">Periodo: ${escapeHtml(periodoLabel)} | Gerado em: ${escapeHtml(geradoEm)}</div>
                </td>
              </tr>

              <tr>
                <td style="padding:20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      ${buildSummaryCards(resumo)}
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 20px 20px;">
                  <div style="font-size:14px; font-weight:700; color:#111827; margin-bottom:10px;">Maquinas selecionadas</div>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb; border-collapse:collapse;">
                    <thead>
                      <tr style="background:#f9fafb;">
                        <th style="padding:10px; text-align:left;">Nome</th>
                        <th style="padding:10px; text-align:left;">Setor</th>
                        <th style="padding:10px; text-align:left;">Tipo</th>
                        <th style="padding:10px; text-align:left;">Criticidade</th>
                        <th style="padding:10px; text-align:right;">Integridade</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${buildMachineRows(maquinas)}
                    </tbody>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:0 20px 24px;">
                  <div style="font-size:14px; font-weight:700; color:#111827; margin-bottom:10px;">Alertas do periodo</div>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb; border-collapse:collapse;">
                    <thead>
                      <tr style="background:#f9fafb;">
                        <th style="padding:10px; text-align:left;">Maquina</th>
                        <th style="padding:10px; text-align:left;">Sensor</th>
                        <th style="padding:10px; text-align:left;">Tipo</th>
                        <th style="padding:10px; text-align:left;">Status</th>
                        <th style="padding:10px; text-align:right;">Criado em</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${buildAlertRows(alertas)}
                    </tbody>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:18px 28px; border-top:1px solid #e5e7eb; background:#f9fafb; font-size:12px; color:#6b7280;">
                  Este email foi gerado automaticamente pelo modulo de relatorios do Orbis.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}

module.exports = {
  gerarRelatorioHTML
};
