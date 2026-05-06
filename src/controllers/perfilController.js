const PerfilService = require("../services/perfilService");
const AppError = require("../utils/appErrorUtils");

class PerfilController {
    static async getPerfil(req, res, next) {
        try {
            const id = req.usuario.id
            const response = await PerfilService.findPerfil(id);
            return res.status(200).json(response)
        } catch (error) {
            next(error)
        }
    }

    static async updatePerfil(req, res, next) {
        try {
            const id = req.usuario.id;
            const response = await PerfilService.updatePerfil({ id, dados: req.body });
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async setOneSignalId(req, res, next) {
        try {
            const id = req.usuario.id;
            const { oneSignalId } = req.body;
            const response = await PerfilService.putOneSignalId({ id, oneSignalId });
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async updateFoto(req, res, next) {
        if (!req.file) {
            return next(new AppError("Arquivo não foi enviado!", 400));
        };
        try {
            const usuarioId = req.usuario.id;
            const buffer = req.file.buffer;
            const response = await PerfilService.updateFotoPerfil({ usuarioId, buffer });
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };
}

module.exports = { PerfilController };
