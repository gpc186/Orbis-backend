const PerfilService = require("../services/perfilService")

class PerfilController {
    static async getPerfil(req, res, next){
        try {
            const id = req.usuario.id
            const response = await PerfilService.findPerfil(id);
            return res.status(200).json(response)
        } catch (error) {
            next(error)
        }
    }

    static async updatePerfil(req, res, next){
        try {
            const id = req.usuario.id;
            const response = await PerfilService.updatePerfil({ id, dados: req.body });
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };

    static async setOneSignalId(req, res, next){
        try {
            const id = req.usuario.id;
            const response = await PerfilService.putOneSignalId({id, oneSignalId: req.body.oneSignalId});
            return res.status(200).json(response);
        } catch (error) {
            next(error);
        };
    };
}

module.exports = { PerfilController };
