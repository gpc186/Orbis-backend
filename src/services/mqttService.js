const mqtt = require("mqtt");
const leituraService = require("./leituraService");
const logger = require("../utils/logger");

const connectMQTT = (app) => {
  const cliente = mqtt.connect(process.env.MQTT_URL, {
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000
  });

  cliente.on("connect", () => {
    logger.info("mqtt_connected", {
      topic: "orbis/leituras"
    });

    cliente.subscribe("orbis/leituras", (error) => {
      if (error) {
        logger.error("mqtt_subscribe_error", {
          topic: "orbis/leituras",
          error
        });
        return;
      }

      logger.info("mqtt_subscribed", {
        topic: "orbis/leituras"
      });
    });
  });

  cliente.on("message", async (topic, message) => {
    const payload = message.toString();

    try {
      const data = JSON.parse(payload);
      const sensorId = Number(data.sensorId ?? process.env.MQTT_SENSOR_ID ?? 1);
      const temperatura = Number(data.temperatura);
      const vibracao = Number(data.vibracao_rms ?? data.vibracao);

      logger.info("mqtt_message_received", {
        topic,
        sensorId: Number.isInteger(sensorId) ? sensorId : null
      });

      if (!Number.isInteger(sensorId)) {
        throw new Error("sensorId invalido na leitura do ESP32.");
      }

      if (!Number.isFinite(temperatura) || !Number.isFinite(vibracao)) {
        throw new Error("temperatura e vibracao devem ser numeros validos.");
      }

      const novaLeitura = await leituraService.processarNovaLeitura({
        sensorId,
        temperatura,
        vibracao
      });

      const io = app.get("io");
      if (io) {
        io.emit("novaLeitura", novaLeitura);

        logger.info("mqtt_websocket_forwarded", {
          topic,
          sensorId
        });
      }
    } catch (error) {
      logger.error("mqtt_message_processing_error", {
        topic,
        payloadSize: payload.length,
        error
      });
    }
  });

  cliente.on("error", (error) => {
    logger.error("mqtt_connection_error", {
      error
    });
  });
};

module.exports = connectMQTT;
