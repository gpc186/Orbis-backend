const cron = require("node-cron");
const SensorModel = require("../models/sensorModel");

const intervaloConfigurado = Number(process.env.SENSOR_OFFLINE_INTERVAL_SECONDS);
const intervaloSegundos = Number.isFinite(intervaloConfigurado) && intervaloConfigurado > 0
    ? intervaloConfigurado
    : 15;

cron.schedule('*/5 * * * * *', async () => {
    try {
        const limiteOffline = new Date();
        limiteOffline.setSeconds(limiteOffline.getSeconds() - intervaloSegundos);

        const response = await SensorModel.updateStatus(limiteOffline);

        if (response.count > 0) {
            console.log(`Foram marcados como OFFLINE ${response.count} sensores`);
        }
    } catch (error) {
        console.error("Erro ao atualizar sensores offline:", error.message);
    }
})
