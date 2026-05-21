const assert = require("node:assert/strict");
const test = require("node:test");

const MaquinaController = require("./maquinaController");
const MaquinaService = require("../services/maquinaService");

test("predicaoAlertas responde com o payload retornado pelo servico", async () => {
  const originalGetPredicaoAlertas = MaquinaService.getPredicaoAlertas;

  const payload = {
    maquinaId: 12,
    proximoAlerta: {
      tipo: "TENDENCIA_CURTA",
      dataPrevista: "2026-05-25T14:00:00.000Z",
      integridadeLimiar: 67.4,
      confianca: 0.78,
      fonteLimiar: "TIPO_MAQUINA",
      amostrasLimiar: 11
    },
    instabilidade: {
      dataPrevista: "2026-05-24T09:00:00.000Z",
      integridadeLimiar: 72.1,
      confianca: 0.81,
      fonteLimiar: "MAQUINA",
      amostrasLimiar: 6
    },
    modeloIntegridade: {
      r2: 0.84,
      slope: -0.92,
      intercept: 96.3,
      pontosUsados: 30
    }
  };

  MaquinaService.getPredicaoAlertas = async () => payload;

  const req = { params: { id: "12" } };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  try {
    await MaquinaController.predicaoAlertas(req, res, (error) => {
      throw error;
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, payload);
  } finally {
    MaquinaService.getPredicaoAlertas = originalGetPredicaoAlertas;
  }
});
