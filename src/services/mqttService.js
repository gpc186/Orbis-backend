const mqtt = require('mqtt');
const leituraService = require('./leituraService');

const connectMQTT = (app) => {
    const cliente = mqtt.connect(process.env.MQTT_URL, {
        keepalive: 60,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
    });

    cliente.on('connect', () => {
        console.log('API conectada ao Broker MQTT');

        cliente.subscribe('orbis/leituras', (err) => {
            if (err) {
                console.error('Erro ao assinar topico orbis/leituras:', err.message);
                return;
            }

            console.log('Monitorando topico: orbis/leituras');
        });
    });

    cliente.on('message', async (topic, message) => {
        const payload = message.toString();

        try {
            const data = JSON.parse(payload);
            console.log('Leitura recebida do ESP32:', data);

            const sensorId = Number(data.sensorId ?? process.env.MQTT_SENSOR_ID ?? 1);
            const temperatura = Number(data.temperatura);
            const vibracao = Number(data.vibracao_rms ?? data.vibracao);

            if (!Number.isInteger(sensorId)) {
                throw new Error('sensorId invalido na leitura do ESP32.');
            }

            if (!Number.isFinite(temperatura) || !Number.isFinite(vibracao)) {
                throw new Error('temperatura e vibracao devem ser numeros validos.');
            }

            const novaLeitura = await leituraService.processarNovaLeitura({
                sensorId,
                temperatura,
                vibracao
            });

            const io = app.get('io');
            if (io) {
                io.emit('novaLeitura', novaLeitura);
                console.log('Dados enviados para o Dashboard via WebSocket');
            }
        } catch (error) {
            console.error('Erro ao processar leitura do ESP32:', error.message, {
                topic,
                payload
            });
        }
    });

    cliente.on('error', (err) => {
        console.error('Erro de conexao MQTT na API:', err.message);
    });
};

module.exports = connectMQTT;
