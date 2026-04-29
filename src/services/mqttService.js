const mqtt = require('mqtt')
const leituraService = require('./leituraService')
const { error } = require('node:console')
const { ModuleKind } = require('typescript')

const connectMQTT = (app) => {
    const cliente = mqtt.connect(process.env.MQTT_URL, {
        username: process.env.MQTT_USER,
        password: process.env.MQTT_PASS,
        rejectUnauthorized: false
    })

    cliente.on('connect', () => {
        console.log('Conectado ao Broker com sucesso')
        cliente.subscribe('orbis/leituras', (err) => {
            if (!err) console.log('Inscrito no tópico de leituras')
        })
    })

    cliente.io('message', async (rota, message) => {
        try {
            const leitura = JSON.parse(message.toString())
            console.log(`MQTT [${rota}]:`, leitura)

            const novaLeitura = await leituraService.processarNovaLeitura({
                sensorId: leitura.sensorId,
                temperatura: leitura.temperatura,
                vibracao: leitura.vibracao
            })

            const io = app.get('io')
            if (io) {
                io.emit('novaLeitura', novaLeitura)
            }
        } catch (error) {
            console.log('Erro ao processar menssagem MQTT:', error.message)
        }
    })

    cliente.on('error', (err) => {
        console.error('Erro no cliente MQTT:', err)
    })
}

module.exports = connectMQTT