const path = require('path');
const dotenv = require('dotenv');

function carregarEnv() {
    const resultadoRaiz = dotenv.config();

    if (!resultadoRaiz.error) {
        return;
    }

    dotenv.config({
        path: path.resolve(__dirname, '..', '.env')
    });
}

module.exports = carregarEnv;
