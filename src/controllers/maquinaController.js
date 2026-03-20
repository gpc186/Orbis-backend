const MaquinaService = require('../services/maquinaService');

class MaquinaController {
    static async store(req, res) {
        try {
            const nova = await MaquinaService.create(req.body);
            return res.status(201).json(nova);
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
    static async index(req, res) {
        try {
            const todas = await MaquinaService.list();
            return res.json(todas);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao listar máquinas" });
        }
    }
    static async delete(req, res) {
        try {
            await MaquinaService.delete(req.params.id);
            return res.status(200).json({ message: "Máquina removida" });
        } catch (error) {
            return res.status(500).json({ error: "Erro ao deletar" });
        }
    }
    static async show(req, res) {
        try {
            const maquina = await MaquinaService.findById(req.params.id)
            return res.status(200).json(maquina);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao mostrar" });
        }
    }
    static async update(req, res) {
        try {
            const atualizada = await MaquinaService.update(req.params.id, req.body)
            return res.status(200).json(atualizada);
        } catch (error) {
            return res.status(500).json({ error: "Erro ao atualizar" });
        }
    }
};

module.exports = MaquinaController;