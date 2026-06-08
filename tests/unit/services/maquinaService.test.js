const { afterEach, test } = require("node:test");
const assert = require("node:assert/strict");

const MaquinaService = require("../../../src/services/maquinaService");
const StorageService = require("../../../src/services/storageService");
const MaquinaManualService = require("../../../src/services/maquinaManualService");
const AlertaPreditivoService = require("../../../src/services/alertaPreditivoService");
const PredicaoRiscoService = require("../../../src/services/predicaoRiscoService");
const MaquinaModel = require("../../../src/models/maquinaModel");

const originals = {
  create: MaquinaModel.create,
  findById: MaquinaModel.findById,
  findByNome: MaquinaModel.findByNome,
  update: MaquinaModel.update,
  upsertManual: MaquinaModel.upsertManual,
  delete: MaquinaModel.delete,
  listPioresIntegridade: MaquinaModel.listPioresIntegridade,
  findComAlertaAtivo: MaquinaModel.findComAlertaAtivo,
  uploadFoto: StorageService.uploadFoto,
  deleteFoto: StorageService.deleteFoto,
  deleteArquivo: StorageService.deleteArquivo,
  buildManualData: MaquinaManualService.buildManualData,
  previewSpecs: MaquinaManualService.previewSpecs,
  alertaPreverPorMaquina: AlertaPreditivoService.preverPorMaquina,
  riscoPreverPorMaquina: PredicaoRiscoService.preverPorMaquina
};

afterEach(() => {
  MaquinaModel.create = originals.create;
  MaquinaModel.findById = originals.findById;
  MaquinaModel.findByNome = originals.findByNome;
  MaquinaModel.update = originals.update;
  MaquinaModel.upsertManual = originals.upsertManual;
  MaquinaModel.delete = originals.delete;
  MaquinaModel.listPioresIntegridade = originals.listPioresIntegridade;
  MaquinaModel.findComAlertaAtivo = originals.findComAlertaAtivo;
  StorageService.uploadFoto = originals.uploadFoto;
  StorageService.deleteFoto = originals.deleteFoto;
  StorageService.deleteArquivo = originals.deleteArquivo;
  MaquinaManualService.buildManualData = originals.buildManualData;
  MaquinaManualService.previewSpecs = originals.previewSpecs;
  AlertaPreditivoService.preverPorMaquina = originals.alertaPreverPorMaquina;
  PredicaoRiscoService.preverPorMaquina = originals.riscoPreverPorMaquina;
});

test("sanitizeForResponse remove dados internos do manual recursivamente", () => {
  const maquinas = MaquinaService.sanitizeForResponse([
    {
      id: 1,
      manual: {
        id: 10,
        caminho: "privado/manual.pdf",
        textoExtraido: "conteudo",
        embedding: [1, 2],
        chunks: ["chunk"],
        especificacoes: { limiteTemperatura: 80 }
      }
    }
  ]);

  assert.deepEqual(maquinas, [
    {
      id: 1,
      manual: {
        id: 10,
        especificacoes: { limiteTemperatura: 80 }
      }
    }
  ]);
});

test("formatCreateData normaliza campos e valida obrigatorios", () => {
  const data = MaquinaService.formatCreateData({
    nome: " Motor ",
    setor: " Linha 1 ",
    tipo: " Prensa ",
    criticidade: "ALTA",
    ativo: "false",
    integridade: "87.5",
    scoreEstabilidade: "92"
  });

  assert.deepEqual(data, {
    nome: "Motor",
    setor: "Linha 1",
    tipo: "Prensa",
    criticidade: "ALTA",
    ativo: false,
    integridade: 87.5,
    scoreEstabilidade: 92
  });

  assert.throws(
    () => MaquinaService.formatCreateData({ nome: "Motor", setor: "Linha", tipo: "" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );

  assert.throws(
    () => MaquinaService.formatCreateData({ nome: "Motor", setor: "Linha", tipo: "A", integridade: "abc" }),
    (error) => error.name === "AppError" && error.statusCode === 400
  );
});

test("create persiste maquina com manual e limpa arquivo quando model falha", async () => {
  const manualFile = { originalname: "manual.pdf" };

  MaquinaManualService.buildManualData = async ({ caminhoPrefixo }) => ({
    nomeArquivo: "manual.pdf",
    caminho: `${caminhoPrefixo}/manual.pdf`,
    url: "https://storage/manual.pdf"
  });

  let createPayload;
  MaquinaModel.create = async (payload) => {
    createPayload = payload;
    return { id: 1, ...payload };
  };

  const created = await MaquinaService.create({
    nome: "Motor",
    setor: "Linha 1",
    tipo: "Prensa"
  }, manualFile);

  assert.equal(created.id, 1);
  assert.equal(createPayload.manual.create.caminho, "maquinas/pendentes/manual.pdf");

  const deletados = [];
  StorageService.deleteArquivo = async (payload) => {
    deletados.push(payload);
  };
  MaquinaModel.create = async () => {
    throw new Error("db fora");
  };

  await assert.rejects(
    () => MaquinaService.create({ nome: "Motor", setor: "Linha 1", tipo: "Prensa" }, manualFile),
    /db fora/
  );

  assert.deepEqual(deletados, [
    {
      bucket: "machine-manuals",
      caminho: "maquinas/pendentes/manual.pdf"
    }
  ]);
});

test("update desativa maquina, remove imagem e apaga storage antigo", async () => {
  MaquinaModel.findById = async () => ({
    id: 5,
    ativo: true,
    caminhoImagem: "maquinas/5/old.webp"
  });

  let updatePayload;
  MaquinaModel.update = async (id, dados) => {
    updatePayload = { id, dados };
    return { id: Number(id), ...dados };
  };

  const deletes = [];
  StorageService.deleteFoto = async (payload) => {
    deletes.push(payload);
  };

  const result = await MaquinaService.update("5", { ativo: "false", nome: "Motor parado" });

  assert.deepEqual(updatePayload, {
    id: "5",
    dados: {
      ativo: false,
      nome: "Motor parado",
      imagem: null,
      caminhoImagem: null
    }
  });
  assert.equal(result.ativo, false);
  assert.deepEqual(deletes, [
    {
      bucket: "machine-images",
      caminho: "maquinas/5/old.webp"
    }
  ]);
});

test("updateFotoMaquina substitui foto antiga e limpa upload novo se update falhar", async () => {
  MaquinaModel.findById = async () => ({
    id: 5,
    ativo: true,
    caminhoImagem: "maquinas/5/old.webp"
  });

  StorageService.uploadFoto = async () => ({
    url: "https://storage/new.webp",
    caminhoImagem: "maquinas/5/new.webp"
  });

  const deletes = [];
  StorageService.deleteFoto = async (payload) => {
    deletes.push(payload);
  };

  MaquinaModel.update = async (id, dados) => ({ id: Number(id), ...dados });

  const result = await MaquinaService.updateFotoMaquina({
    maquinaId: 5,
    buffer: Buffer.from("img")
  });

  assert.equal(result.imagem, "https://storage/new.webp");
  assert.deepEqual(deletes, [
    {
      bucket: "machine-images",
      caminho: "maquinas/5/old.webp"
    }
  ]);

  deletes.length = 0;
  MaquinaModel.update = async () => {
    throw new Error("update falhou");
  };

  await assert.rejects(
    () => MaquinaService.updateFotoMaquina({ maquinaId: 5, buffer: Buffer.from("img") }),
    /update falhou/
  );

  assert.deepEqual(deletes, [
    {
      bucket: "machine-images",
      caminho: "maquinas/5/new.webp"
    }
  ]);
});

test("updateManualMaquina faz upsert e remove manual antigo", async () => {
  MaquinaModel.findById = async () => ({
    id: 7,
    nome: "Motor",
    setor: "Linha",
    tipo: "Prensa",
    criticidade: "ALTA",
    ativo: true,
    manual: { caminho: "maquinas/7/manual/old.pdf" }
  });

  MaquinaManualService.buildManualData = async ({ caminhoPrefixo }) => ({
    nomeArquivo: "manual.pdf",
    caminho: `${caminhoPrefixo}/new.pdf`
  });

  let upsertPayload;
  MaquinaModel.upsertManual = async (maquinaId, data) => {
    upsertPayload = { maquinaId, data };
    return { id: 3, ...data };
  };

  const deletes = [];
  StorageService.deleteArquivo = async (payload) => {
    deletes.push(payload);
  };

  const result = await MaquinaService.updateManualMaquina({
    maquinaId: 7,
    file: { originalname: "manual.pdf" }
  });

  assert.equal(result.caminho, "maquinas/7/manual/new.pdf");
  assert.deepEqual(upsertPayload, {
    maquinaId: 7,
    data: {
      nomeArquivo: "manual.pdf",
      caminho: "maquinas/7/manual/new.pdf"
    }
  });
  assert.deepEqual(deletes, [
    {
      bucket: "machine-manuals",
      caminho: "maquinas/7/manual/old.pdf"
    }
  ]);
});

test("consultas preditivas delegam services e encapsulam falhas inesperadas", async () => {
  const chamadas = [];
  AlertaPreditivoService.preverPorMaquina = async (id) => {
    chamadas.push(["alertas", id]);
    return { maquinaId: Number(id), estadoPredicao: "SEM_DADOS" };
  };
  PredicaoRiscoService.preverPorMaquina = async (id) => {
    chamadas.push(["risco", id]);
    return { maquinaId: Number(id), risco: "BAIXO" };
  };

  assert.deepEqual(await MaquinaService.getPredicaoAlertas("9"), {
    maquinaId: 9,
    estadoPredicao: "SEM_DADOS"
  });
  assert.deepEqual(await MaquinaService.getPredicaoRisco("9"), {
    maquinaId: 9,
    risco: "BAIXO"
  });
  assert.deepEqual(chamadas, [
    ["alertas", "9"],
    ["risco", "9"]
  ]);

  AlertaPreditivoService.preverPorMaquina = async () => {
    throw new Error("modelo fora");
  };

  await assert.rejects(
    () => MaquinaService.getPredicaoAlertas("9"),
    (error) => error.name === "AppError" && error.statusCode === 500
  );
});

test("listCriticas e findComAlertaAtivo normalizam limit antes do model", async () => {
  const chamadas = [];
  MaquinaModel.listPioresIntegridade = async ({ limit }) => {
    chamadas.push(["criticas", limit]);
    return [];
  };
  MaquinaModel.findComAlertaAtivo = async ({ limit }) => {
    chamadas.push(["alerta", limit]);
    return [];
  };

  await MaquinaService.listCriticas({ limit: "999" });
  await MaquinaService.findComAlertaAtivo({ limit: "abc" });

  assert.deepEqual(chamadas, [
    ["criticas", 20],
    ["alerta", 10]
  ]);
});
