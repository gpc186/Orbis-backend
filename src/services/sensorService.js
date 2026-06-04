const SensorModel = require("../models/sensorModel");
const MaquinaModel = require("../models/maquinaModel");
const AppError = require("../utils/appErrorUtils");

class SensorService {
  static parseNumericField(value, fieldName, { required = true } = {}) {
    if (value === undefined || value === null || value === "") {
      if (required) {
        throw new AppError(`${fieldName} e obrigatorio e deve ser um numero valido.`, 400);
      }

      return undefined;
    }

    const parsed = parseFloat(value);
    if (!Number.isFinite(parsed)) {
      throw new AppError(`${fieldName} e obrigatorio e deve ser um numero valido.`, 400);
    }

    return parsed;
  }

  static validateThresholdRelations(dados) {
    if (!(dados.idealTemperatura < dados.limiteTemperatura)) {
      throw new AppError("idealTemperatura deve ser menor que limiteTemperatura.", 400);
    }

    if (!(dados.idealVibracao < dados.limiteVibracao)) {
      throw new AppError("idealVibracao deve ser menor que limiteVibracao.", 400);
    }

    if (dados.desvioMaximoTemp !== undefined && !(dados.desvioMaximoTemp > 0)) {
      throw new AppError("desvioMaximoTemp deve ser maior que zero.", 400);
    }

    if (dados.desvioMaximoVibra !== undefined && !(dados.desvioMaximoVibra > 0)) {
      throw new AppError("desvioMaximoVibra deve ser maior que zero.", 400);
    }
  }

  static normalizeSensorPayload(dados, { existing = null } = {}) {
    const limiteTemperatura = this.parseNumericField(
      dados.limiteTemperatura !== undefined ? dados.limiteTemperatura : existing?.limiteTemperatura,
      "limiteTemperatura"
    );
    const idealTemperatura = this.parseNumericField(
      dados.idealTemperatura !== undefined ? dados.idealTemperatura : existing?.idealTemperatura,
      "idealTemperatura"
    );
    const limiteVibracao = this.parseNumericField(
      dados.limiteVibracao !== undefined ? dados.limiteVibracao : existing?.limiteVibracao,
      "limiteVibracao"
    );
    const idealVibracao = this.parseNumericField(
      dados.idealVibracao !== undefined ? dados.idealVibracao : existing?.idealVibracao,
      "idealVibracao"
    );
    const desvioMaximoTemp = this.parseNumericField(
      dados.desvioMaximoTemp !== undefined ? dados.desvioMaximoTemp : existing?.desvioMaximoTemp,
      "desvioMaximoTemp",
      { required: false }
    );
    const desvioMaximoVibra = this.parseNumericField(
      dados.desvioMaximoVibra !== undefined ? dados.desvioMaximoVibra : existing?.desvioMaximoVibra,
      "desvioMaximoVibra",
      { required: false }
    );

    const normalized = {
      ...dados,
      limiteTemperatura,
      idealTemperatura,
      limiteVibracao,
      idealVibracao,
      ...(desvioMaximoTemp !== undefined ? { desvioMaximoTemp } : {}),
      ...(desvioMaximoVibra !== undefined ? { desvioMaximoVibra } : {})
    };

    this.validateThresholdRelations(normalized);

    return normalized;
  }

  static async create(dados) {
    try {
      const maquinaId = parseInt(dados.maquinaId);
      if (!Number.isInteger(maquinaId)) {
        throw new AppError("maquinaId deve ser um numero inteiro valido.", 400);
      }

      const maquinaExiste = await MaquinaModel.findById(maquinaId);
      if (!maquinaExiste) {
        throw new AppError("Nao e possivel criar o sensor: Maquina selecionada nao existe.", 400);
      }

      const dadosFormatados = this.normalizeSensorPayload({
        ...dados,
        maquinaId
      });

      return await SensorModel.create(dadosFormatados);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao criar sensor.", 500);
    }
  }

  static async list() {
    try {
      return await SensorModel.findAll();
    } catch (error) {
      throw new AppError("Erro ao listar sensores.", 500);
    }
  }

  static async findById(id) {
    try {
      const sensor = await SensorModel.findById(id);
      if (!sensor) throw new AppError("Sensor nao encontrado.", 404);
      return sensor;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao buscar sensor.", 500);
    }
  }

  static async findByTipo({ tipo, maquinaId, status, limit = 10 }) {
    const tipoNormalizado = String(tipo || "").trim();

    if (tipoNormalizado.length < 2) {
      throw new AppError("Tipo invalido para busca de sensor.", 400);
    }

    const take = Math.min(Math.max(Number(limit || 10), 1), 20);

    try {
      const sensores = await SensorModel.findByTipo({
        tipo: tipoNormalizado,
        maquinaId,
        status,
        take
      });

      return {
        total: sensores.length,
        dados: sensores
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao buscar sensores por tipo.", 500);
    }
  }

  static async findByMaquinaId({ maquinaId, status, limit = 10 }) {
    const maquinaIdNum = parseInt(maquinaId);

    if (!Number.isInteger(maquinaIdNum)) {
      throw new AppError("Id da maquina invalido para busca de sensores.", 400);
    }

    const take = Math.min(Math.max(Number(limit || 10), 1), 20);

    try {
      const maquina = await MaquinaModel.findById(maquinaIdNum);
      if (!maquina) {
        throw new AppError("Maquina nao encontrada.", 404);
      }

      const sensores = await SensorModel.findByMaquinaId({
        maquinaId: maquinaIdNum,
        status,
        take
      });

      return {
        total: sensores.length,
        dados: sensores
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao buscar sensores por maquina.", 500);
    }
  }

  static async update(id, dados) {
    try {
      const sensorExiste = await SensorModel.findById(id);
      if (!sensorExiste) throw new AppError("Sensor nao encontrado.", 404);

      if (!dados.maquinaId || dados.maquinaId === null || dados.maquinaId === undefined) {
        return await SensorModel.updateDisconnect(id, { ...dados, status: "INATIVO" });
      }

      const maquinaExiste = await MaquinaModel.findById(dados.maquinaId);
      if (!maquinaExiste) {
        throw new AppError("Maquina selecionada nao existe.", 400);
      }

      const dadosValidados = this.normalizeSensorPayload(dados, {
        existing: sensorExiste
      });

      return await SensorModel.update(id, dadosValidados);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao atualizar sensor.", 500);
    }
  }

  static async delete(id) {
    try {
      const sensor = await SensorModel.findById(id);
      if (!sensor) throw new AppError("Sensor nao encontrado.", 404);
      return await SensorModel.delete(id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Erro ao deletar sensor.", 500);
    }
  }

  static async countActive() {
    try {
      return await SensorModel.countActiveSensors();
    } catch (error) {
      throw new AppError("Erro ao contar sensores ativos.", 500);
    }
  }

  static async listOfflineRecentes({ limit = 10 } = {}) {
    const take = Math.min(Math.max(Number(limit || 10), 1), 20);

    try {
      const sensores = await SensorModel.listOfflineRecentes({ limit: take });
      return {
        total: sensores.length,
        dados: sensores
      };
    } catch (error) {
      throw new AppError("Erro ao listar sensores offline.", 500);
    }
  }
}

module.exports = SensorService;
