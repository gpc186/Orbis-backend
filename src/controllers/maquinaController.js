const MaquinaService = require('../services/maquinaService');
const AppError = require('../utils/appErrorUtils');
class MaquinaController {
    static async store(req, res, next) {
        try {
            const nova = await MaquinaService.create(req.body, req.file);
            return res.status(201).json(MaquinaService.sanitizeForResponse(nova));
        } catch (error) {
            next(error)
        }
    }
    static async index(req, res, next) {
        try {
            const todas = await MaquinaService.list();
            return res.json(MaquinaService.sanitizeForResponse(todas));
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
            return res.status(200).json(MaquinaService.sanitizeForResponse(maquina));
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
            const response = await MaquinaService.updateFotoMaquina({ maquinaId, buffer });
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };
    static async updateManual(req, res, next){
        if(!req.file){
            return next(new AppError("Manual nÃ£o enviado!", 400));
        };
        try {
            const maquinaId = req.params.id;
            const response = await MaquinaService.updateManualMaquina({ maquinaId, file: req.file });
            return res.status(200).json(MaquinaService.sanitizeManualForResponse(response));
        } catch (error) {
            next(error);
        };
    };
    static async previewManual(req, res, next){
        if(!req.file){
            return next(new AppError("Manual nao enviado!", 400));
        };
        try {
            const response = await MaquinaService.previewManualSpecs({
                maquinaId: req.body.maquinaId,
                file: req.file
            });
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };
};

module.exports = MaquinaController;
