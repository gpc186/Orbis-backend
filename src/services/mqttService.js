const mqtt = require("mqtt");
const leituraService = require("./leituraService");
const logger = require("../utils/logger");

const MQTT_TOPIC = "orbis/leituras";

function createConnectMQTT({
  mqttModule = mqtt,
  leituraProcessor = leituraService,
  log = logger
} = {}) {
  return (app) => {
    const cliente = mqttModule.connect(process.env.MQTT_URL, {
      keepalive: 60,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000
    });

    cliente.on("connect", () => {
      log.info("mqtt_connected", {
        topic: MQTT_TOPIC
      });

      cliente.subscribe(MQTT_TOPIC, (error) => {
        if (error) {
          log.error("mqtt_subscribe_error", {
            topic: MQTT_TOPIC,
            error
          });
          return;
        }

        log.info("mqtt_subscribed", {
          topic: MQTT_TOPIC
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

        log.info("mqtt_message_received", {
          topic,
          sensorId: Number.isInteger(sensorId) ? sensorId : null
        });

        if (!Number.isInteger(sensorId)) {
          throw new Error("sensorId invalido na leitura do ESP32.");
        }

        if (!Number.isFinite(temperatura) || !Number.isFinite(vibracao)) {
          throw new Error("temperatura e vibracao devem ser numeros validos.");
        }

        const novaLeitura = await leituraProcessor.processarNovaLeitura({
          sensorId,
          temperatura,
          vibracao
        });

        const io = app.get("io");
        if (io) {
          io.emit("novaLeitura", novaLeitura);

          log.info("mqtt_websocket_forwarded", {
            topic,
            sensorId
          });
        }
      } catch (error) {
        log.error("mqtt_message_processing_error", {
          topic,
          payloadSize: payload.length,
          error
        });
      }
    });

    cliente.on("error", (error) => {
      log.error("mqtt_connection_error", {
        error
      });
    });
  };
}

const connectMQTT = createConnectMQTT();

module.exports = connectMQTT;
module.exports.createConnectMQTT = createConnectMQTT;
module.exports.MQTT_TOPIC = MQTT_TOPIC;
