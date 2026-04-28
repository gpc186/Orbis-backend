const MaquinaService = require('../services/maquinaService');
const StorageService = require('../services/storageService');
const AppError = require('../utils/appErrorUtils');
class MaquinaController {
    static async store(req, res, next) {
        try {
            const nova = await MaquinaService.create(req.body, id, role);
            return res.status(201).json(nova);
        } catch (error) {
            next(error)
        }
    }
    static async index(req, res, next) {
        try {
            const todas = await MaquinaService.list();
            return res.json(todas);
        } catch (error) {
            next(error)
        }
    }
    static async delete(req, res, next) {
        try {
            await MaquinaService.delete(req.params.id);
            return res.status(200).json({ message: "Máquina removida" });
        } catch (error) {
            next(error)
        }
    }
    static async show(req, res, next) {
        try {
            const maquina = await MaquinaService.findById(req.params.id)
            return res.status(200).json(maquina);
        } catch (error) {
            next(error)
        }
    }
    static async update(req, res, next) {
        try {
            const atualizada = await MaquinaService.update(req.params.id, req.body)
            return res.status(200).json(atualizada);
        } catch (error) {
            next(error)
        }
    }
    static async updateFoto(req, res, next){
        if(!req.file){
            return next(new AppError("Imagem não enviada!", 400));
        };
        try {
            const maquinaId = req.params.id;
            const buffer = req.file.buffer;
            const response = await StorageService.uploadFotoMaquina({ maquinaId, buffer });
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };
};

module.exports = MaquinaController;