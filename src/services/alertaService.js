const MaquinaModel = require('../models/maquinaModel');
const AppError = require("../utils/appErrorUtils")
const prisma = require("../prisma/prisma")

class AlertaService {
    static async gerarAlerta(sensorId, maquinaId, tipo, mensagem) {
        const alertaExistente = await prisma.alerta.findFirst({
            where: {
                sensorId,
                tipo,
                status: 'ATIVO'
            }
        })

        if (alertaExistente) {
            return await prisma.alerta.update({
                where: {id: alertaExistente.id},
                data: {
                    mensagem: `${mensagem} (Ocorrência repetida em ${new Date().toLocaleDateString})`,
                    eventos: {
                        create: {tipo: 'ATUALIZADO', descricao: 'Limite ultrapassado novamente'}
                    }
                }
            })
        }

        const novoAlerta = await prisma.alerta.create({
            data: {
                sensorId,
                maquinaId,
                tipo,
                mensagem,
                status: 'ATIVO'
            }
        })

        console.log(`🚨 NOVO ALERTA [${tipo}]: ${mensagem}`);
        return novoAlerta;
    }
}

module.exports = AlertaService