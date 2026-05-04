const mqtt = require('mqtt');
const leituraService = require('./leituraService');

const connectMQTT = (app) => {
    // Configuração para o Broker Público do HiveMQ
    const cliente = mqtt.connect(process.env.MQTT_URL, {
        keepalive: 60,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
    });

    cliente.on('connect', () => {
        console.log('✅ API conectada ao Broker Público do HiveMQ');
        
        // Assina o tópico que o seu ESP32 está usando
        cliente.subscribe('orbis/leituras', (err) => {
            if (!err) {
                console.log('📡 Monitorando tópico: orbis/leituras');
            }
        });
    });

    cliente.on('message', async (topic, message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log("📥 Leitura recebida do ESP32:", data);

            // Mapeia os dados do ESP32 para o formato do seu Banco de Dados
            // O seu ESP32 envia 'vibracao_rms' e 'temperatura'
            const novaLeitura = await leituraService.processarNovaLeitura({
                sensorId: 1, // ID padrão para o sensor físico
                temperatura: data.temperatura,
                vibracao: data.vibracao_rms 
            });

            // Envia para o Dashboard em tempo real via Socket.io
            const io = app.get('io');
            if (io) {
                io.emit('novaLeitura', novaLeitura);
                console.log("🚀 Dados enviados para o Dashboard via WebSocket");
            }

        } catch (error) {
            console.error('❌ Erro ao processar leitura do ESP32:', error.message);
        }
    });

    cliente.on('error', (err) => {
        console.error('⚠️ Erro de conexão MQTT na API:', err.message);
    });
};

module.exports = connectMQTT;