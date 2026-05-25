const assert = require("node:assert/strict");
const test = require("node:test");

const SensorModel = require("../models/sensorModel");
const SensorService = require("./sensorService");
const AppError = require("../utils/appErrorUtils");

test("findById preserva 404 quando sensor nao existe", async () => {
  const originalFindById = SensorModel.findById;

  SensorModel.findById = async () => null;

  try {
    await assert.rejects(
      () => SensorService.findById(999),
      (error) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      }
    );
  } finally {
    SensorModel.findById = originalFindById;
  }
});
