const mqtt = require('mqtt');

// Endereço do "ponto de encontro" (Broker)
const MQTT_URL = 'mqtt://broker.hivemq.com:1883';
const MQTT_TOPIC = 'orbis/leituras'; // O mesmo tópico do seu código ESP32

console.log("🚀 Simulando ESP32 enviando para a API no Render...");

const client = mqtt.connect(MQTT_URL);

client.on('connect', () => {
    console.log("✅ Conectado ao Broker HiveMQ!");

    setInterval(() => {
        const payload = {
            sensorId: 2,
            temperatura: parseFloat((22 + Math.random() * 5).toFixed(2)),
            vibracao_rms: parseFloat((Math.random() * 3).toFixed(2))
        };

        client.publish(MQTT_TOPIC, JSON.stringify(payload));
        console.log("📤 Dados enviados para o Broker:", payload);
    }, 5000); // Envia a cada 5 segundos
});

client.on('error', (err) => console.error("❌ Erro:", err));