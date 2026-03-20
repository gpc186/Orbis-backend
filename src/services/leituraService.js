const { Prisma } = require('@prisma/client');
const leituraModel = require('../models/leituraModel')

class leituraService {
    static async processarNovaLeitura(dadosLeitura) {
        if (dadosLeitura.temperatura > 80) {
            console.log("⚠️ ALERTA: Temperatura crítica detectada!");
        } else if (dadosLeitura.vibracao > 10) {
            console.log("⚠️ ALERTA: Vibração crítica detectada!");
        }
        console.log("2. Tratei no Service");
        return await leituraModel.store(dadosLeitura)
    }

    static async index(limite = 20) {
        return await leituraModel.index(limite)
    }
}



module.exports = leituraService