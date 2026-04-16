const cron = require("node-cron");
const SensorModel = require("../models/sensorModel");

cron.schedule('*/5 * * * *', async () => {
    const quinzeSegundosAtras = new Date();
    quinzeSegundosAtras.setSeconds(quinzeSegundosAtras.getSeconds() - 15);

    const response = await SensorModel.updateStatus(quinzeSegundosAtras);

    if(response.count > 0){
        console.log(`Foram marcados como OFFLINE ${response.count} sensores`);
    }
})