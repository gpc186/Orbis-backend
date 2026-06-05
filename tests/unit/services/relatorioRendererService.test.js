const assert = require("node:assert/strict");
const test = require("node:test");

const RelatorioDataService = require("../../../src/services/relatorioDataService");
const RelatorioRendererService = require("../../../src/services/relatorioRendererService");

function patchMethods(target, methods) {
  const originals = {};

  for (const [key, value] of Object.entries(methods)) {
    originals[key] = target[key];
    target[key] = value;
  }

  return () => {
    for (const [key, value] of Object.entries(originals)) {
      target[key] = value;
    }
  };
}

test("buildEscopo descreve filtros e secoes legiveis", () => {
  assert.equal(RelatorioRendererService.buildEscopo({}), "Abrangencia completa");
  const escopo = RelatorioRendererService.buildEscopo({
    maquinasIds: [1],
    sensoresIds: [2, 3],
    usuariosIds: [4, 5],
    secoes: ["resumo", "sensores", "custom"]
  });

  assert.match(escopo, /1 maquina filtrada/);
  assert.match(escopo, /2 sensores filtrados/);
  assert.match(escopo, /2 tecnicos filtrados/);
  assert.match(escopo, /Secoes: Resumo, Sensores, custom/);
});

test("buildSubject e buildTextFallback priorizam assunto, nome e periodo", () => {
  assert.equal(
    RelatorioRendererService.buildSubject({
      assunto: "Assunto manual",
      nome: "Semanal",
      periodoLabel: "7 dias"
    }),
    "Assunto manual"
  );
  assert.equal(
    RelatorioRendererService.buildSubject({
      nome: "Semanal",
      periodoLabel: "7 dias"
    }),
    "Semanal - 7 dias"
  );
  assert.equal(
    RelatorioRendererService.buildSubject({
      periodoLabel: "7 dias"
    }),
    "Relatorio Operacional Orbis - 7 dias"
  );
  assert.equal(
    RelatorioRendererService.buildTextFallback({ periodoLabel: "7 dias" }),
    [
      "Relatorio operacional Orbis",
      "Periodo: 7 dias",
      "Abra o email em modo HTML para visualizar os detalhes."
    ].join("\n")
  );
});

test("render coleta dados, gera escopo e retorna subject/text/html/data", async () => {
  let capturedCollect;
  const restoreData = patchMethods(RelatorioDataService, {
    collect: async (args) => {
      capturedCollect = args;
      return {
        periodoLabel: "Ultimos 7 dias",
        resumo: {
          maquinasAtivas: 2,
          maquinasAltaImportancia: 1,
          integridadeMedia: 82,
          chamadosAbertos: 3
        },
        sensores: {
          online: 4,
          offline: 1,
          inativo: 0
        }
      };
    }
  });

  try {
    const result = await RelatorioRendererService.render({
      nome: "Resumo Orbis",
      assunto: null,
      periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
      filtros: {
        maquinasIds: [1, 2],
        sensoresIds: [3],
        usuariosIds: [],
        secoes: ["resumo", "sensores"]
      }
    });

    assert.deepEqual(capturedCollect, {
      periodo: { tipo: "RELATIVE_DAYS", valor: 7 },
      filtros: {
        maquinasIds: [1, 2],
        sensoresIds: [3],
        usuariosIds: [],
        secoes: ["resumo", "sensores"]
      }
    });
    assert.equal(result.subject, "Resumo Orbis - Ultimos 7 dias");
    assert.match(result.text, /Periodo: Ultimos 7 dias/);
    assert.match(result.html, /Resumo Orbis/);
    assert.match(result.html, /2 maquinas filtradas/);
    assert.match(result.html, /Secoes: Resumo, Sensores/);
    assert.equal(result.periodoLabel, "Ultimos 7 dias");
    assert.equal(result.data.resumo.integridadeMedia, 82);
  } finally {
    restoreData();
  }
});
