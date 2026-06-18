function getRealtimeContext(leitura) {
  return leitura?._realtime || {};
}

function buildLeituraPayload(leitura) {
  const realtime = getRealtimeContext(leitura);

  if (!realtime.maquinaId || leitura.maquinaId !== undefined) {
    return leitura;
  }

  return {
    ...leitura,
    maquinaId: realtime.maquinaId
  };
}

function buildMaquinaPayload(realtime) {
  const maquina = realtime.maquina || null;
  const maquinaId = realtime.maquinaId || maquina?.id;

  if (!maquinaId) {
    return null;
  }

  return {
    maquinaId,
    maquina,
    integridade: maquina?.integridade ?? realtime.integridade ?? null,
    scoreEstabilidade: maquina?.scoreEstabilidade ?? null
  };
}

function emitLeituraRealtime(io, leitura) {
  if (!io) {
    return;
  }

  const leituraPayload = buildLeituraPayload(leitura);
  const realtime = getRealtimeContext(leitura);

  io.emit("nova-leitura", leituraPayload);
  io.emit("novaLeitura", leituraPayload);

  const maquinaPayload = buildMaquinaPayload(realtime);
  if (maquinaPayload) {
    io.emit("maquina-atualizada", maquinaPayload);
    io.emit("maquinaAtualizada", maquinaPayload);
  }

  if (realtime.historicoIntegridade) {
    const historicoPayload = {
      maquinaId: realtime.historicoIntegridade.maquinaId,
      historico: realtime.historicoIntegridade
    };

    io.emit("historico-integridade-atualizado", historicoPayload);
    io.emit("historicoIntegridadeAtualizado", historicoPayload);
    io.emit("dashboard-maquina-atualizado", {
      maquinaId: historicoPayload.maquinaId,
      maquina: realtime.maquina || null,
      historicoIntegridade: realtime.historicoIntegridade,
      leitura: leituraPayload
    });
    io.emit("dashboardMaquinaAtualizado", {
      maquinaId: historicoPayload.maquinaId,
      maquina: realtime.maquina || null,
      historicoIntegridade: realtime.historicoIntegridade,
      leitura: leituraPayload
    });
  }
}

module.exports = {
  emitLeituraRealtime
};
