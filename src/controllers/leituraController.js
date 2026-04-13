const leituraService = require('../services/leituraService')

class LeituraController {
    static async store(req, res, next) {
        try {
            console.log("Conteúdo recebido:", req.body);
            const { sensorId, temperatura, vibracao } = req.body;
            // Validação corrigida: verifica se os campos existem (mesmo que sejam 0)
            if (sensorId === undefined || temperatura === undefined || vibracao === undefined) {
                return res.status(400).json({ error: "Dados incompletos" });
            }

            const novaLeitura = await leituraService.processarNovaLeitura(req.body)

            const io = req.app.get('io')
            if (io) io.emit('nova-leitura', novaLeitura)

            return res.status(201).json(novaLeitura);
        } catch (error) {
            next(error)
        }
    }
    static async index(req, res, next) {
        try {
            const leituras = await leituraService.index()
            return res.json(leituras.reverse())
        } catch (error) {
            next(error)
        }
    }


}



module.exports = LeituraController;