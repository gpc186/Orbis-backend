function mapUsuario(item) {
  return {
    id: item.id,
    nome: item.nome,
    email: item.email,
    role: item.role,
    ativo: item.ativo,
    especialidade: item.especialidade,
    telefone: item.telefone
  };
}

function mapSensor(item) {
  return {
    id: item.id,
    tipo: item.tipo,
    status: item.status,
    limiteTemperatura: item.limiteTemperatura,
    idealTemperatura: item.idealTemperatura,
    limiteVibracao: item.limiteVibracao,
    idealVibracao: item.idealVibracao,
    ultimaTemperatura: item.ultimaTemperatura,
    ultimaVibracao: item.ultimaVibracao,
    ultimaLeituraEm: item.ultimaLeituraEm,
    maquina: item.maquina
      ? {
          id: item.maquina.id,
          nome: item.maquina.nome,
          setor: item.maquina.setor,
          criticidade: item.maquina.criticidade,
          ativo: item.maquina.ativo
        }
      : null
  };
}

function mapAlerta(item) {
  return {
    id: item.id,
    tipo: item.tipo,
    status: item.status,
    mensagem: item.mensagem,
    criadoEm: item.criadoEm,
    encerradoEm: item.encerradoEm,
    sla: item.sla || null,
    sensor: item.sensor
      ? {
          id: item.sensor.id,
          tipo: item.sensor.tipo,
          status: item.sensor.status
        }
      : null,
    maquina: item.maquina
      ? {
          id: item.maquina.id,
          nome: item.maquina.nome,
          setor: item.maquina.setor,
          criticidade: item.maquina.criticidade,
          ativo: item.maquina.ativo,
          integridade: item.maquina.integridade
        }
      : null,
    tecnico: item.tecnico
      ? {
          id: item.tecnico.id,
          nome: item.tecnico.nome,
          email: item.tecnico.email,
          role: item.tecnico.role,
          ativo: item.tecnico.ativo
        }
      : null
  };
}

function mapMaquina(item) {
  return {
    id: item.id,
    nome: item.nome,
    setor: item.setor,
    tipo: item.tipo,
    criticidade: item.criticidade,
    ativo: item.ativo,
    integridade: item.integridade,
    scoreEstabilidade: item.scoreEstabilidade,
    previsaoManutencao: item.previsaoManutencao,
    janelaManuInicio: item.janelaManuInicio,
    janelaManuFim: item.janelaManuFim
  };
}

function mapManutencao(item) {
  return {
    id: item.id,
    alertaId: item.alertaId,
    usuarioId: item.usuarioId,
    observacao: item.observacao,
    status: item.status,
    criadoEm: item.criadoEm,
    alerta: item.alerta
      ? {
          id: item.alerta.id,
          tipo: item.alerta.tipo,
          status: item.alerta.status,
          mensagem: item.alerta.mensagem
        }
      : null,
    usuario: item.usuario
      ? {
          id: item.usuario.id,
          nome: item.usuario.nome,
          email: item.usuario.email,
          role: item.usuario.role,
          telefone: item.usuario.telefone,
          especialidade: item.usuario.especialidade
        }
      : null
  };
}

function mapAlertaEvento(item) {
  return {
    id: item.id,
    alertaId: item.alertaId,
    tipo: item.tipo,
    statusAnterior: item.statusAnterior,
    statusNovo: item.statusNovo,
    mensagem: item.mensagem,
    descricao: item.descricao,
    criadoEm: item.criadoEm,
    usuario: item.usuario
      ? {
          id: item.usuario.id,
          nome: item.usuario.nome,
          email: item.usuario.email,
          role: item.usuario.role
        }
      : null,
    manutencao: item.manutencao
      ? {
          id: item.manutencao.id,
          status: item.manutencao.status,
          criadoEm: item.manutencao.criadoEm
        }
      : null
  };
}

function mapRelatorioAgendamento(item) {
  return {
    id: item.id,
    nome: item.nome,
    status: item.status,
    frequencia: item.frequencia,
    hora: item.hora,
    minuto: item.minuto,
    diaSemana: item.diaSemana,
    diaMes: item.diaMes,
    assunto: item.assunto,
    tipoPeriodo: item.tipoPeriodo,
    periodo: item.periodo,
    filtros: item.filtros,
    secoes: item.secoes,
    proximoEnvioEm: item.proximoEnvioEm,
    ultimoEnvioEm: item.ultimoEnvioEm,
    ultimoSucessoEm: item.ultimoSucessoEm,
    ultimoErroEm: item.ultimoErroEm,
    descricaoAgendamento: item.descricaoAgendamento,
    criadoPor: item.criadoPor
      ? {
          id: item.criadoPor.id,
          nome: item.criadoPor.nome,
          email: item.criadoPor.email,
          role: item.criadoPor.role
        }
      : null,
    destinatarios: Array.isArray(item.destinatarios)
      ? item.destinatarios.map((destinatario) => ({
          id: destinatario.id,
          email: destinatario.email,
          nome: destinatario.nome,
          criadoEm: destinatario.criadoEm
        }))
      : []
  };
}

function mapRelatorioExecucao(item) {
  return {
    id: item.id,
    agendamentoId: item.agendamentoId,
    tipoExecucao: item.tipoExecucao,
    status: item.status,
    assunto: item.assunto,
    emailsDestino: item.emailsDestino,
    provider: item.provider,
    messageId: item.messageId,
    erro: item.erro,
    iniciadoEm: item.iniciadoEm,
    finalizadoEm: item.finalizadoEm
  };
}

function mapDisambiguationAgendamento(item) {
  return {
    id: item.id,
    nome: item.nome,
    status: item.status,
    descricaoAgendamento: item.descricaoAgendamento,
    destinatarios: Array.isArray(item.destinatarios)
      ? item.destinatarios.map((destinatario) => destinatario.email)
      : []
  };
}

function mapDisambiguationSensor(item) {
  return {
    id: item.id,
    tipo: item.tipo,
    status: item.status,
    maquina: item.maquina
      ? {
          id: item.maquina.id,
          nome: item.maquina.nome,
          setor: item.maquina.setor
        }
      : null
  };
}

module.exports = {
  mapUsuario,
  mapSensor,
  mapAlerta,
  mapMaquina,
  mapManutencao,
  mapAlertaEvento,
  mapRelatorioAgendamento,
  mapRelatorioExecucao,
  mapDisambiguationAgendamento,
  mapDisambiguationSensor
};
