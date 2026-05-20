const LOGO_URL = "https://iyoztaljmpklixtftsub.supabase.co/storage/v1/object/public/email-images/LogoBrancaGrande.svg";
const { REPORT_TIMEZONE } = require("../utils/reportScheduleUtils");

function esc(value) {
  if (value == null) return "";

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildPtBrDateOptions(extraOptions = {}) {
  return {
    timeZone: REPORT_TIMEZONE,
    ...extraOptions
  };
}

function formatarData(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR", buildPtBrDateOptions({
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }));
}

function formatarDataCurta(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(5).replace("-", "/") || "-";
  }

  return date.toLocaleDateString("pt-BR", buildPtBrDateOptions({
    day: "2-digit",
    month: "2-digit"
  }));
}

function formatarDataHora(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR", buildPtBrDateOptions({
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }));
}

function renderSectionTitle(label, subtitle = "") {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-bottom:1px solid #d6d3d1;padding-bottom:4px;">
      <tr>
        <td>
          <p style="margin:0;font-size:10px;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.18em;color:#44403c;">
            ${esc(label)}
          </p>
          ${subtitle
            ? `<p style="margin:6px 0 0;font-size:11px;color:#78716c;">${esc(subtitle)}</p>`
            : ""}
        </td>
      </tr>
    </table>`;
}

function renderEmailMetric(label, value, sub) {
  return `
    <td width="25%" valign="top" style="padding:0 6px 0 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border:1px solid #e7e5e4;background:#ffffff;">
        <tr>
          <td style="padding:12px;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:500;
                      text-transform:uppercase;letter-spacing:0.05em;color:#78716c;">
              ${esc(label)}
            </p>
            <p style="margin:0 0 4px;font-size:20px;font-weight:600;
                      color:#1c1917;line-height:1.15;">
              ${esc(String(value))}
            </p>
            ${sub
              ? `<p style="margin:0;font-size:11px;color:#78716c;">${esc(sub)}</p>`
              : ""}
          </td>
        </tr>
      </table>
    </td>`;
}

function renderTh(label, right = false) {
  return `<th style="padding:10px 12px;font-size:10px;font-weight:600;text-transform:uppercase;
                     letter-spacing:0.08em;color:#57534e;text-align:${right ? "right" : "left"};
                     border-bottom:1px solid #e7e5e4;">
            ${esc(label)}
          </th>`;
}

function renderPlainStatusBadge(value) {
  const text = String(value || "-");
  const isOk = ["OK", "ONLINE", "RESOLVIDO", "ENCERRADO", "OPERANDO", "ATIVO"].includes(text);

  return `<span style="display:inline-block;padding:2px 8px;font-size:10px;font-weight:500;
                       border:1px solid #d6d3d1;
                       background:${isOk ? "#ffffff" : "#fafaf9"};
                       color:${isOk ? "#44403c" : "#1c1917"};">
            ${esc(text)}
          </span>`;
}

function renderEstado(message, colspan = 10) {
  return `
    <tr>
      <td colspan="${colspan}" style="padding:32px 16px;text-align:center;font-size:12px;
                                      color:#78716c;background:#fafaf9;border:1px dashed #d6d3d1;">
        ${esc(message)}
      </td>
    </tr>`;
}

function renderMiniTable(title, rows) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border:1px solid #e7e5e4;background:#ffffff;">
      <tr>
        <td colspan="2" style="padding:12px;font-size:11px;font-weight:600;color:#1c1917;background:#fafaf9;border-bottom:1px solid #e7e5e4;">
          ${esc(title)}
        </td>
      </tr>
      ${rows.map((row) => `
        <tr>
          <td style="padding:10px 12px;font-size:11px;color:#57534e;border-bottom:1px solid #f5f5f4;">${esc(row.label)}</td>
          <td style="padding:10px 12px;font-size:11px;font-weight:600;color:#1c1917;text-align:right;border-bottom:1px solid #f5f5f4;">
            ${esc(row.value)}
          </td>
        </tr>
      `).join("")}
    </table>`;
}

function renderIntegridadePorSetor(rows) {
  if (!rows.length) {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin-top:16px;border:1px solid #e7e5e4;border-collapse:collapse;">
        ${renderEstado("Nenhum setor encontrado.", 2)}
      </table>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-top:16px;border:1px solid #e7e5e4;border-collapse:collapse;">
      <thead>
        <tr style="background:#fafaf9;">
          ${renderTh("Setor")}
          ${renderTh("Integridade media", true)}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;color:#1c1917;">
              ${esc(row.setor)}
            </td>
            <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;color:#1c1917;text-align:right;font-weight:600;">
              ${esc(`${row.integridadeMedia}%`)}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>`;
}

function renderChamadosTable(chamados, faltantes) {
  if (!chamados.length) {
    return renderEstado("Nenhum chamado no periodo selecionado.", 6);
  }

  return `
    <thead>
      <tr style="background:#fafaf9;">
        ${renderTh("Maquina")}
        ${renderTh("Sensor")}
        ${renderTh("Tipo")}
        ${renderTh("Status")}
        ${renderTh("Tecnico")}
        ${renderTh("Criado", true)}
      </tr>
    </thead>
    <tbody>
      ${chamados.map((item) => `
        <tr>
          <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;font-weight:600;color:#1c1917;">
            ${esc(item.maquina || "-")}
          </td>
          <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;color:#57534e;">
            ${esc(item.sensor || "-")}
          </td>
          <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;color:#57534e;">
            ${esc(item.tipo || "-")}
          </td>
          <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;">
            ${renderPlainStatusBadge(item.status || "-")}
          </td>
          <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;color:#57534e;">
            ${esc(item.tecnico?.nome || "-")}
          </td>
          <td style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;color:#78716c;text-align:right;">
            ${formatarData(item.criadoEm)}
          </td>
        </tr>
      `).join("")}
      ${faltantes > 0
        ? `<tr>
             <td colspan="6" style="padding:9px 12px;font-size:11px;border-bottom:1px solid #f5f5f4;text-align:center;background:#fafaf9;color:#78716c;">
               + ${faltantes} chamados nao exibidos.
             </td>
           </tr>`
        : ""}
    </tbody>`;
}

function renderLogo() {
  return `
    <table cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="font-size:0;line-height:0;">
          <img
            src="${esc(LOGO_URL)}"
            alt="Orbis"
            width="128"
            style="display:block;width:128px;max-width:128px;height:auto;border:0;outline:none;text-decoration:none;"
          />
        </td>
      </tr>
      <tr>
        <td style="padding-top:6px;">
          <p style="margin:0;font-size:11px;line-height:1.4;color:#d6d3d1;">
            Caso a imagem nao carregue, considere a marca Orbis.
          </p>
        </td>
      </tr>
    </table>`;
}

function getTimelineCircleColor(quantidade, maiorQuantidade) {
  if (quantidade <= 0) {
    return {
      background: "#bbf7d0",
      border: "#22c55e",
      text: "#166534"
    };
  }

  const intensity = maiorQuantidade <= 1
    ? 1
    : quantidade / maiorQuantidade;

  if (intensity >= 0.85) {
    return {
      background: "#6d28d9",
      border: "#5b21b6",
      text: "#ffffff"
    };
  }

  if (intensity >= 0.5) {
    return {
      background: "#8b5cf6",
      border: "#7c3aed",
      text: "#ffffff"
    };
  }

  return {
    background: "#c4b5fd",
    border: "#8b5cf6",
    text: "#4c1d95"
  };
}

function renderTimelineCircle(quantidade, maiorQuantidade) {
  const colors = getTimelineCircleColor(quantidade, maiorQuantidade);

  return `
    <table align="center" cellpadding="0" cellspacing="0" border="0"
           style="border-collapse:separate;">
      <tr>
        <td width="28" height="28" align="center" valign="middle"
            style="width:28px;height:28px;border-radius:28px;background:${colors.background};border:2px solid ${colors.border};font-size:11px;line-height:1;font-weight:700;color:${colors.text};">
          ${esc(quantidade)}
        </td>
      </tr>
    </table>`;
}

function renderHistoricoTendenciaTimeline(points) {
  if (!points.length) {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin-top:12px;border:1px solid #e7e5e4;border-collapse:collapse;">
        ${renderEstado("Nenhum ponto de tendencia encontrado.", 7)}
      </table>`;
  }

  const timelinePoints = points.slice(-7);
  const maiorQuantidade = Math.max(...timelinePoints.map((item) => Number(item.quantidade || 0)), 0);

  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-top:12px;border:1px solid #e7e5e4;background:#ffffff;">
      <tr>
        <td style="padding:18px 20px 8px;">
          <p style="margin:0;font-size:11px;color:#78716c;">
            Ultimos 7 dias
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 18px 18px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
            <tr>
              ${timelinePoints.map((item) => `
                <td align="center" valign="bottom" style="padding:0 4px 8px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#1c1917;">
                    ${esc(formatarDataCurta(item.data))}
                  </p>
                  <p style="margin:0;font-size:10px;color:#78716c;">
                    ${esc(`${item.quantidade} alerta${Number(item.quantidade) === 1 ? "" : "s"}`)}
                  </p>
                </td>
              `).join("")}
            </tr>
            <tr>
              ${timelinePoints.map((item) => {
                const quantidade = Number(item.quantidade || 0);
                const colors = getTimelineCircleColor(quantidade, maiorQuantidade);

                return `
                  <td align="center" valign="middle" style="padding:2px 4px;">
                    ${renderTimelineCircle(quantidade, maiorQuantidade)}
                    <p style="margin:8px 0 0;font-size:10px;font-weight:600;color:${colors.border};">
                      ${esc(quantidade > 0 ? "Com alerta" : "Sem alerta")}
                    </p>
                  </td>`;
              }).join("")}
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildStatusLabel(integridadeMedia) {
  if (integridadeMedia == null) {
    return "Sem resumo";
  }

  if (integridadeMedia >= 75) return "Frota Estavel";
  if (integridadeMedia >= 50) return "Atencao Necessaria";
  return "Estado Critico";
}

function gerarRelatorioHTML({ data = {}, config = {} }) {
  const resumo = data.resumo;
  const desempenho = data.desempenho;
  const sensores = data.sensores;
  const chamados = Array.isArray(data.chamados) ? data.chamados : null;
  const historicoTendencia = Array.isArray(data.historicoTendencia) ? data.historicoTendencia : null;

  const titulo = config.nome || "Relatorio Operacional";
  const periodoLabel = config.periodoLabel || "30 dias";
  const escopo = config.escopo || "Completo";
  const geradoEm = formatarDataHora(new Date());
  const integridadeMedia = resumo?.integridadeMedia ?? null;
  const integridadeArredondada = integridadeMedia == null ? null : Math.round(Number(integridadeMedia) || 0);
  const pctIntegridade = integridadeArredondada == null
    ? 0
    : Math.min(100, Math.max(0, integridadeArredondada));
  const statusLabel = buildStatusLabel(integridadeMedia);
  const chamadosVisiveis = chamados ? chamados.slice(0, 10) : [];
  const chamadosFaltantes = chamados ? chamados.length - chamadosVisiveis.length : 0;
  const historicoTimeline = historicoTendencia ? historicoTendencia.slice(-7) : [];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${esc(titulo)} - Orbis</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f4;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table width="680" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:680px;background:#ffffff;border:1px solid #e7e5e4;">

        <tr>
          <td style="padding:18px 32px;background:#1c1917;border-bottom:1px solid #312e2b;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  ${renderLogo()}
                </td>
                <td valign="middle" align="right" style="padding-left:16px;">
                  <p style="margin:0;font-size:10px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#d6d3d1;">
                    Relatorio operacional
                  </p>
                  <p style="margin:6px 0 0;font-size:11px;color:#a8a29e;">
                    ${esc(periodoLabel)}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 20px;border-bottom:1px solid #d6d3d1;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="top">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#1c1917;">
                    ${esc(titulo)}
                  </p>
                  <p style="margin:0 0 2px;font-size:11px;color:#78716c;">Gerado em ${esc(geradoEm)}</p>
                  <p style="margin:0 0 2px;font-size:11px;color:#78716c;">Periodo: ${esc(periodoLabel)}</p>
                  <p style="margin:0;font-size:11px;color:#78716c;">Escopo: ${esc(escopo)}</p>
                </td>
                <td valign="top" align="right" style="padding-left:16px;white-space:nowrap;">
                  <span style="display:inline-block;padding:4px 12px;font-size:11px;
                               font-weight:600;color:#1c1917;border:1px solid #d6d3d1;background:#ffffff;">
                    ${esc(statusLabel)}
                  </span>
                  <p style="margin:6px 0 0;font-size:10px;color:#78716c;text-align:right;">
                    Integridade media: ${integridadeArredondada == null ? "-" : `${integridadeArredondada}%`}
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${resumo ? `
        <tr>
          <td style="padding:24px 32px 0;">
            ${renderSectionTitle("Visao Geral da Frota")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
              <tr>
                ${renderEmailMetric("Maquinas ativas", resumo.maquinasAtivas ?? 0, "Maquinas monitoradas")}
                ${renderEmailMetric("Alta importancia", resumo.maquinasAltaImportancia ?? 0, "Maquinas criticas")}
                ${renderEmailMetric("Integridade media", `${Math.round(Number(resumo.integridadeMedia || 0))}%`, "Media de toda a frota")}
                ${renderEmailMetric("Chamados abertos", resumo.chamadosAbertos ?? 0, "Chamados ativos no periodo")}
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="border:1px solid #e7e5e4;background:#ffffff;">
              <tr>
                <td style="padding:14px 16px 12px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                    <tr>
                      <td>
                        <span style="font-size:10px;font-weight:600;text-transform:uppercase;
                                     letter-spacing:0.18em;color:#78716c;">
                          Integridade da frota
                        </span>
                      </td>
                      <td align="right">
                        <span style="font-size:13px;font-weight:600;color:#1c1917;">
                          ${Math.round(Number(resumo.integridadeMedia || 0))}%
                        </span>
                      </td>
                    </tr>
                  </table>
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      ${pctIntegridade > 0
                        ? `<td width="${pctIntegridade}%" height="8" style="background:#7c3aed;font-size:0;line-height:0;">&nbsp;</td>`
                        : ""}
                      ${pctIntegridade < 100
                        ? `<td width="${100 - pctIntegridade}%" height="8" style="background:#e7e5e4;font-size:0;line-height:0;">&nbsp;</td>`
                        : ""}
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ""}

        ${sensores ? `
        <tr>
          <td style="padding:24px 32px 0;">
            ${renderSectionTitle("Indicadores Operacionais")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
              <tr>
                ${renderEmailMetric("Sensores online", sensores.online ?? 0, "Sensores ativos")}
                ${renderEmailMetric("Sensores offline", sensores.offline ?? 0, "Sensores sem comunicacao")}
                ${renderEmailMetric("Sensores inativos", sensores.inativo ?? 0, "Sensores desativados")}
                ${renderEmailMetric("Total de sensores", (sensores.online ?? 0) + (sensores.offline ?? 0) + (sensores.inativo ?? 0), "Visao consolidada")}
              </tr>
            </table>
          </td>
        </tr>` : ""}

        ${desempenho ? `
        <tr>
          <td style="padding:24px 32px 0;">
            ${renderSectionTitle("Desempenho")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
              <tr>
                <td width="50%" valign="top" style="padding-right:8px;">
                  ${renderMiniTable("Status das maquinas", [
                    { label: "Operando", value: desempenho.statusDasMaquinas?.operando ?? 0 },
                    { label: "Em alerta", value: desempenho.statusDasMaquinas?.emAlerta ?? 0 },
                    { label: "Inativa", value: desempenho.statusDasMaquinas?.inativa ?? 0 }
                  ])}
                </td>
                <td width="50%" valign="top" style="padding-left:8px;">
                  ${renderMiniTable("Maquinas por importancia", [
                    { label: "Alta", value: desempenho.maquinasPorImportancia?.alta ?? 0 },
                    { label: "Media", value: desempenho.maquinasPorImportancia?.media ?? 0 },
                    { label: "Baixa", value: desempenho.maquinasPorImportancia?.baixa ?? 0 }
                  ])}
                </td>
              </tr>
            </table>
            ${renderIntegridadePorSetor(Array.isArray(desempenho.integridadePorSetor) ? desempenho.integridadePorSetor : [])}
          </td>
        </tr>` : ""}

        ${chamados ? `
        <tr>
          <td style="padding:24px 32px 0;">
            ${renderSectionTitle("Chamados Tecnicos")}
            <table width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="margin-top:12px;border:1px solid #e7e5e4;border-collapse:collapse;">
              ${renderChamadosTable(chamadosVisiveis, chamadosFaltantes)}
            </table>
          </td>
        </tr>` : ""}

        ${historicoTendencia ? `
        <tr>
          <td style="padding:24px 32px 0;">
            ${renderSectionTitle("Historico de Tendencia", "Ultimos 7 dias")}
            ${renderHistoricoTendenciaTimeline(historicoTimeline)}
          </td>
        </tr>` : ""}

        <tr>
          <td style="padding:20px 32px;border-top:1px solid #e7e5e4;background:#fafaf9;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:#78716c;">
                    Este relatorio foi gerado automaticamente pelo sistema Orbis.
                  </p>
                </td>
                <td align="right" valign="middle">
                  <span style="font-size:12px;font-weight:700;color:#57534e;letter-spacing:0.08em;text-transform:uppercase;">
                    Orbis
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:14px 0 0;font-size:11px;color:#a8a29e;text-align:center;">
        Gerado em ${esc(geradoEm)} &nbsp;&middot;&nbsp; Periodo: ${esc(periodoLabel)}
      </p>
    </td>
  </tr>
</table>

</body>
</html>`;
}

module.exports = { gerarRelatorioHTML };
