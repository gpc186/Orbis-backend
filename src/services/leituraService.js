const leituraModel = require('../models/leituraModel')

const processarNovaLeitura = async (dadosLeitura) => {
    if (dadosLeitura.temperatura > 80) {
        console.log("⚠️ ALERTA: Temperatura crítica detectada!");
    } else if (dadosLeitura.vibracao > 10) {
        console.log("⚠️ ALERTA: Vibração crítica detectada!");
    }
    console.log("2. Tratei no Service");
    return await leituraModel.criarLeitura(dadosLeitura)
}

module.exports = {processarNovaLeitura}