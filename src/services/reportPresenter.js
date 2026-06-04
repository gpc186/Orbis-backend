const {
  buildScheduleDescription,
  formatReportDateTime
} = require("../utils/reportScheduleUtils");

function mapRelatorioAgendamentoResponse(agendamento) {
  return {
    ...agendamento,
    proximoEnvioEm: formatReportDateTime(agendamento.proximoEnvioEm),
    ultimoEnvioEm: formatReportDateTime(agendamento.ultimoEnvioEm),
    ultimoSucessoEm: formatReportDateTime(agendamento.ultimoSucessoEm),
    criadoEm: formatReportDateTime(agendamento.criadoEm),
    atualizadoEm: formatReportDateTime(agendamento.atualizadoEm),
    descricaoAgendamento: buildScheduleDescription({
      frequencia: agendamento.frequencia,
      hora: agendamento.hora,
      minuto: agendamento.minuto,
      diaSemana: agendamento.diaSemana,
      diaMes: agendamento.diaMes
    })
  };
}

function mapRelatorioExecucaoResponse(execucao) {
  return {
    ...execucao,
    iniciadoEm: formatReportDateTime(execucao.iniciadoEm),
    finalizadoEm: formatReportDateTime(execucao.finalizadoEm)
  };
}

module.exports = {
  mapRelatorioAgendamentoResponse,
  mapRelatorioExecucaoResponse
};
