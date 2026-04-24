const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
require('dotenv').config();

// Configurações da simulação
const API_URL = 'http://localhost:3333/leituras';
const INTERVALO_MS = 5000; // Gera uma leitura a cada 5 segundos

async function gerarLeituras() {
    console.log("🚀 Iniciando simulador de leituras...");

    // 1. Busca todos os sensores ativos para simular
    const sensores = await prisma.sensor.findMany({
        where: { status: 'ONLINE' },
        include: { maquina: true }
    });

    if (sensores.length === 0) {
        console.error("❌ Nenhum sensor ONLINE encontrado. Cadastre máquinas e sensores primeiro.");
        return;
    }

    console.log(`📡 Simulando dados para ${sensores.length} sensores.`);

    setInterval(async () => {
        for (const sensor of sensores) {
            try {
                // Gera valores levemente aleatórios em torno do "ideal"
                // ou força um erro ocasional para testar os alertas
                const chanceDeErro = Math.random() > 0.95; // 5% de chance de ultrapassar limite

                const tempBase = sensor.idealTemperatura + 10; //chanceDeErro ? sensor.limiteTemperatura + 5 : sensor.idealTemperatura;
                const vibraBase = sensor.idealVibracao//chanceDeErro ? sensor.limiteVibracao + 2 : sensor.idealVibracao;

                const temperatura = parseFloat((tempBase + (Math.random() * 4 - 2)).toFixed(2));
                const vibracao = parseFloat((vibraBase + (Math.random() * 2 - 1)).toFixed(2));

                // 2. Salva a Leitura
                const dadosLeitura = {
                    sensorId: sensor.id,
                    temperatura: parseFloat(temperatura.toFixed(2)),
                    vibracao: parseFloat(vibracao.toFixed(2))
                };

                const config = {
                    headers: {
                        'x-api-key': 'chavezinha-legal'
                    }
                }

                // 2. Envia para a rota no servidor (HTTP POST) [cite: 7, 72]
                const response = await axios.post(API_URL, dadosLeitura, config);

                // 3. Atualiza o estado do Sensor (Última leitura)
                await prisma.sensor.update({
                    where: { id: sensor.id },
                    data: {
                        ultimaTemperatura: temperatura,
                        ultimaVibracao: vibracao,
                        ultimaLeituraEm: new Date()
                    }
                });

                console.log(`✅ [Sensor ${sensor.id} - ${sensor.maquina.nome}] Temp: ${temperatura}°C | Vib: ${vibracao}mm/s`);

            } catch (err) {
                console.error(`❌ Erro ao processar sensor ${sensor.id}:`, err.message);
            }
        }
    }, INTERVALO_MS);
}

gerarLeituras();