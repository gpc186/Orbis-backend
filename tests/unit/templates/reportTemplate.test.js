const assert = require("node:assert/strict");
const test = require("node:test");

const { gerarRelatorioHTML } = require("../../../src/templates/reportTemplate");

const RealDate = Date;

function useFakeNow(isoString) {
  const fixedNow = new RealDate(isoString);

  global.Date = class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return new RealDate(fixedNow);
      }

      return new RealDate(...args);
    }

    static now() {
      return fixedNow.getTime();
    }

    static parse(value) {
      return RealDate.parse(value);
    }

    static UTC(...args) {
      return RealDate.UTC(...args);
    }
  };

  return () => {
    global.Date = RealDate;
  };
}

test("template renderiza 'Gerado em' no timezone de Sao Paulo", () => {
  const restoreDate = useFakeNow("2026-05-20T19:04:00.000Z");

  try {
    const html = gerarRelatorioHTML({
      data: {},
      config: {
        nome: "Teste",
        periodoLabel: "7 dias",
        escopo: "Abrangencia completa"
      }
    });

    assert.match(html, /Gerado em 20 de maio de 2026 às 16:04/);
    assert.doesNotMatch(html, /Gerado em 20 de maio de 2026 às 19:04/);
  } finally {
    restoreDate();
  }
});

test("template escapa dados dinamicos e renderiza secoes principais", () => {
  const restoreDate = useFakeNow("2026-05-20T19:04:00.000Z");

  try {
    const chamados = Array.from({ length: 11 }, (_, index) => ({
      maquina: index === 0 ? "Prensa <script>" : `Prensa ${index}`,
      sensor: "Temperatura & vibracao",
      tipo: "LIMITE_ULTRAPASSADO",
      status: index === 0 ? "ATIVO" : "PENDENTE",
      tecnico: { nome: index === 0 ? "Ana <Tech>" : "Carlos" },
      criadoEm: index === 0 ? "data-invalida" : "2026-05-20T12:00:00.000Z"
    }));

    const html = gerarRelatorioHTML({
      data: {
        resumo: {
          maquinasAtivas: 3,
          maquinasAltaImportancia: 1,
          integridadeMedia: 82,
          chamadosAbertos: 2
        },
        sensores: {
          online: 7,
          offline: 2,
          inativo: 1
        },
        desempenho: {
          statusDasMaquinas: {
            operando: 2,
            emAlerta: 1,
            inativa: 0
          },
          maquinasPorImportancia: {
            alta: 1,
            media: 2,
            baixa: 0
          },
          integridadePorSetor: [
            { setor: "Usinagem <A>", integridadeMedia: 80 }
          ]
        },
        chamados,
        historicoTendencia: [
          { data: "2026-05-13", quantidade: 0 },
          { data: "2026-05-14", quantidade: 1 },
          { data: "2026-05-15", quantidade: 2 },
          { data: "2026-05-16", quantidade: 3 },
          { data: "2026-05-17", quantidade: 4 },
          { data: "2026-05-18", quantidade: 5 },
          { data: "2026-05-19", quantidade: 6 },
          { data: "valor-invalido", quantidade: 7 }
        ]
      },
      config: {
        nome: "Relatorio <Operacional>",
        periodoLabel: "7 dias & noite",
        escopo: "Setor <A>"
      }
    });

    assert.match(html, /Relatorio &lt;Operacional&gt;/);
    assert.match(html, /7 dias &amp; noite/);
    assert.match(html, /Setor &lt;A&gt;/);
    assert.match(html, /Prensa &lt;script&gt;/);
    assert.match(html, /Temperatura &amp; vibracao/);
    assert.match(html, /Ana &lt;Tech&gt;/);
    assert.match(html, /Usinagem &lt;A&gt;/);
    assert.match(html, /Frota Estavel/);
    assert.match(html, /Sensores online/);
    assert.match(html, /Chamados Tecnicos/);
    assert.match(html, /Historico de Tendencia/);
    assert.match(html, /\+ 1 chamados nao exibidos/);
  } finally {
    restoreDate();
  }
});

test("template renderiza estados vazios para secoes sem dados", () => {
  const html = gerarRelatorioHTML({
    data: {
      desempenho: {
        statusDasMaquinas: {},
        maquinasPorImportancia: {},
        integridadePorSetor: []
      },
      chamados: [],
      historicoTendencia: []
    },
    config: {
      nome: "Relatorio vazio",
      periodoLabel: "30 dias",
      escopo: "Completo"
    }
  });

  assert.match(html, /Sem resumo/);
  assert.match(html, /Nenhum setor encontrado/);
  assert.match(html, /Nenhum chamado no periodo selecionado/);
  assert.match(html, /Nenhum ponto de tendencia encontrado/);
});

test("template classifica status por integridade media", () => {
  const baixo = gerarRelatorioHTML({
    data: { resumo: { integridadeMedia: 40 } },
    config: { nome: "Baixo" }
  });
  const medio = gerarRelatorioHTML({
    data: { resumo: { integridadeMedia: 60 } },
    config: { nome: "Medio" }
  });
  const alto = gerarRelatorioHTML({
    data: { resumo: { integridadeMedia: 90 } },
    config: { nome: "Alto" }
  });

  assert.match(baixo, /Estado Critico/);
  assert.match(medio, /Atencao Necessaria/);
  assert.match(alto, /Frota Estavel/);
});
