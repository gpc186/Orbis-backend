const prisma = require('../prisma/prisma');
const { options } = require('../routes/leituraRoutes');

class MaquinaModel {
    static async create(data) {
        return await prisma.maquina.create({data});
    }

    static async findAll() {
        return await prisma.maquina.findMany({include: {sensores: true}});
    }

    static async findById(id) {
        return await prisma.maquina.findUnique({where: {id: parseInt(id)}}, ...options);
    }

    static async update(id, data) {
        return await prisma.maquina.update({where: {id: parseInt(id)}, data});
    }

    static async delete(id) {
        return await prisma.maquina.delete({where: {id: parseInt(id)}});
    }
}


module.exports = MaquinaModel