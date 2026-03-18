const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

const criarLeitura = async (dados) => {
    return await prisma.leitura.create({
        data:{
            sensorId: Number(dados.sensorId),
            temperatura: Number(dados.temperatura),
            vibracao: Number(dados.vibracao)
        }
    })
}
console.log("3. Enviando ao Prisma/Banco");
module.exports = {criarLeitura}