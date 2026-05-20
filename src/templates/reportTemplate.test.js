const assert = require("node:assert/strict");
const test = require("node:test");

const { gerarRelatorioHTML } = require("./reportTemplate");

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
