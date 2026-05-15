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

function buildMetricCards(resumo = {}) {
  const cards = [
    ["Maquinas ativas", resumo.maquinasAtivas ?? 0],
    ["Alta importancia", resumo.maquinasAltaImportancia ?? 0],
    ["Integridade media", `${resumo.integridadeMedia ?? 0}%`],
    ["Chamados abertos", resumo.chamadosAbertos ?? 0]
  ];

  return cards.map(([label, value]) => `
    <td style="padding:8px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:14px;">
            <div style="font-size:11px; text-transform:uppercase; color:#6b7280;">${escapeHtml(label)}</div>
            <div style="font-size:22px; font-weight:700; color:#111827; margin-top:6px;">${escapeHtml(value)}</div>
          </td>
        </tr>
      </table>
    </td>
  `).join("");
}

function buildSimpleRow(label, value) {
  return `
    <tr>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(label)}</td>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb; text-align:right; font-weight:600;">${escapeHtml(value)}</td>
    </tr>
  `;
}

function buildChamadosRows(chamados = []) {
  if (!chamados.length) {
    return `
      <tr>
        <td colspan="6" style="padding:12px; text-align:center; color:#6b7280;">
          Nenhum chamado encontrado no periodo selecionado.
        </td>
      </tr>
    `;
  }

  return chamados.slice(0, 10).map((chamado) => `
    <tr>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(chamado.maquina || "-")}</td>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(chamado.sensor || "-")}</td>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(chamado.tipo || "-")}</td>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(chamado.status || "-")}</td>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(chamado.tecnico?.nome || "-")}</td>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb; text-align:right;">${escapeHtml(formatDateTime(chamado.criadoEm))}</td>
    </tr>
  `).join("");
}

function buildHistoricoRows(historicoTendencia = []) {
  if (!historicoTendencia.length) {
    return `
      <tr>
        <td colspan="2" style="padding:12px; text-align:center; color:#6b7280;">
          Nenhum ponto de tendencia encontrado.
        </td>
      </tr>
    `;
  }

  return historicoTendencia.map((item) => `
    <tr>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(item.data)}</td>
      <td style="padding:10px; border-bottom:1px solid #e5e7eb; text-align:right;">${escapeHtml(item.quantidade)}</td>
    </tr>
  `).join("");
}

function gerarRelatorioHTML({ data = {}, config = {} }) {
  const { resumo, desempenho, sensores, chamados, historicoTendencia } = data;
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

              ${resumo ? `
              <tr>
                <td style="padding:20px;">
                  <div style="font-size:14px; font-weight:700; color:#111827; margin-bottom:10px;">Resumo</div>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>${buildMetricCards(resumo)}</tr>
                  </table>
                </td>
              </tr>` : ""}

              ${desempenho ? `
              <tr>
                <td style="padding:0 20px 20px;">
                  <div style="font-size:14px; font-weight:700; color:#111827; margin-bottom:10px;">Desempenho</div>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td width="50%" style="padding-right:10px; vertical-align:top;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;">
                          <tr><td colspan="2" style="padding:12px; font-weight:700; background:#f9fafb;">Status das maquinas</td></tr>
                          ${buildSimpleRow("Operando", desempenho.statusDasMaquinas?.operando ?? 0)}
                          ${buildSimpleRow("Em alerta", desempenho.statusDasMaquinas?.emAlerta ?? 0)}
                          ${buildSimpleRow("Inativa", desempenho.statusDasMaquinas?.inativa ?? 0)}
                        </table>
                      </td>
                      <td width="50%" style="padding-left:10px; vertical-align:top;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;">
                          <tr><td colspan="2" style="padding:12px; font-weight:700; background:#f9fafb;">Maquinas por importancia</td></tr>
                          ${buildSimpleRow("Alta", desempenho.maquinasPorImportancia?.alta ?? 0)}
                          ${buildSimpleRow("Media", desempenho.maquinasPorImportancia?.media ?? 0)}
                          ${buildSimpleRow("Baixa", desempenho.maquinasPorImportancia?.baixa ?? 0)}
                        </table>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb; border-collapse:collapse; margin-top:16px;">
                    <thead>
                      <tr style="background:#f9fafb;">
                        <th style="padding:10px; text-align:left;">Setor</th>
                        <th style="padding:10px; text-align:right;">Integridade media</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${(desempenho.integridadePorSetor || []).map((item) => `
                        <tr>
                          <td style="padding:10px; border-bottom:1px solid #e5e7eb;">${escapeHtml(item.setor)}</td>
                          <td style="padding:10px; border-bottom:1px solid #e5e7eb; text-align:right;">${escapeHtml(item.integridadeMedia)}%</td>
                        </tr>
                      `).join("") || `
                        <tr>
                          <td colspan="2" style="padding:12px; text-align:center; color:#6b7280;">Nenhum setor encontrado.</td>
                        </tr>
                      `}
                    </tbody>
                  </table>
                </td>
              </tr>` : ""}

              ${sensores ? `
              <tr>
                <td style="padding:0 20px 20px;">
                  <div style="font-size:14px; font-weight:700; color:#111827; margin-bottom:10px;">Sensores</div>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb;">
                    ${buildSimpleRow("Online", sensores.online ?? 0)}
                    ${buildSimpleRow("Offline", sensores.offline ?? 0)}
                    ${buildSimpleRow("Inativo", sensores.inativo ?? 0)}
                  </table>
                </td>
              </tr>` : ""}

              ${Array.isArray(chamados) ? `
              <tr>
                <td style="padding:0 20px 20px;">
                  <div style="font-size:14px; font-weight:700; color:#111827; margin-bottom:10px;">Chamados</div>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb; border-collapse:collapse;">
                    <thead>
                      <tr style="background:#f9fafb;">
                        <th style="padding:10px; text-align:left;">Maquina</th>
                        <th style="padding:10px; text-align:left;">Sensor</th>
                        <th style="padding:10px; text-align:left;">Tipo</th>
                        <th style="padding:10px; text-align:left;">Status</th>
                        <th style="padding:10px; text-align:left;">Tecnico</th>
                        <th style="padding:10px; text-align:right;">Criado em</th>
                      </tr>
                    </thead>
                    <tbody>${buildChamadosRows(chamados)}</tbody>
                  </table>
                </td>
              </tr>` : ""}

              ${Array.isArray(historicoTendencia) ? `
              <tr>
                <td style="padding:0 20px 24px;">
                  <div style="font-size:14px; font-weight:700; color:#111827; margin-bottom:10px;">Historico de tendencia</div>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e5e7eb; border-collapse:collapse;">
                    <thead>
                      <tr style="background:#f9fafb;">
                        <th style="padding:10px; text-align:left;">Data</th>
                        <th style="padding:10px; text-align:right;">Quantidade de alertas</th>
                      </tr>
                    </thead>
                    <tbody>${buildHistoricoRows(historicoTendencia)}</tbody>
                  </table>
                </td>
              </tr>` : ""}

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

module.exports = { gerarRelatorioHTML };
