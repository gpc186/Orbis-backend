const SensorService = require('../services/sensorService')


class SensorController {
    static async store(req, res) {
        try {
            const { tipo, status, limiteTemperatura, limiteVibracao, maquinaId } = req.body

            if (!tipo || !maquinaId) {
                return res.status(400).json({ error: "Tipo e maquinaId são obrigatórios" })
            }

            const novoSensor = await SensorService.create(req.body)
            return res.status(201).json(novoSensor)
        } catch (error) {
            console.error("Erro ao criar sensor", error)
            return res.status(500).json({ error: "Erro interno ao criar sensor" })
        }
    }
    static async index(req, res) {
        try {
            const sensores = await SensorService.list()
            return res.json(sensores)
        } catch (error) {
            return res.status(500).json({ error: "Erro ao listar sensores" })
        }
    }
    static async delete(req, res) {
        try {
            const { id } = req.params
            await SensorService.delete(id)
            return res.status(204).send()
        } catch (error) {
            return res.status(500).json({ error: "Erro ao deletar sensor" })
        }
    }
    static async update(req, res) {
        try {
            // Pegando id da URL e dados do Corpo
            const atualizado = await SensorService.update(req.params.id, req.body);
            return res.status(200).json(atualizado);
        } catch (error) {
            console.error("❌ Erro no Update Sensor:", error); // ISSO AJUDA A DEBUGAR
            return res.status(500).json({ error: error.message || "Erro ao atualizar sensor" });
        }
    }
    static async show(req, res) {
        try {
            const sensor = await SensorService.findById(req.params.id)
            return res.json(sensor)
        } catch (error) {
            return res.status(500).json({ error: "Erro ao mostrar sensor" })
        }
    }
}

module.exports = SensorController