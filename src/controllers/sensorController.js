const SensorService = require('../services/sensorService')


class SensorController {
    static async store(req, res, next) {
        try {
            const { tipo, maquinaId } = req.body

            if (!tipo || !maquinaId) {
                return res.status(400).json({ error: "Tipo e maquinaId são obrigatórios" })
            }
            const novoSensor = await SensorService.create(req.body)
            return res.status(201).json(novoSensor)
        } catch (error) {
            next(error)
        }
    }
    static async index(req, res, next) {
        try {
            const sensores = await SensorService.list()
            return res.json(sensores)
        } catch (error) {
            next(error)
        }
    }
    static async delete(req, res, next) {
        try {
            const { id } = req.params
            await SensorService.delete(id)
            return res.status(204).send()
        } catch (error) {
            next(error)
        }
    }
    static async update(req, res, next) {
        try {
            // Pegando id da URL e dados do Corpo
            const atualizado = await SensorService.update(req.params.id, req.body);
            return res.status(200).json(atualizado);
        } catch (error) {
            next(error)
        }
    }
    static async show(req, res, next) {
        try {
            const sensor = await SensorService.findById(req.params.id)
            return res.json(sensor)
        } catch (error) {
            next(error)
        }
    }
}

module.exports = SensorController