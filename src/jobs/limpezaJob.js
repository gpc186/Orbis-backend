const cron = require("node-cron");
const LeituraModel = require("../models/leituraModel");

cron.schedule('0 0 * * *', async () => {
    const trintaDiasAtras = new Date()
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const quantidadeDeletada = await LeituraModel.limpeza(trintaDiasAtras);
    console.log(`Foram deletadas ${quantidadeDeletada.count} leituras do banco de dados por terem ultrapassado o periodo de 30 dias`);  
});