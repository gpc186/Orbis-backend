const leituraService = require('../services/leituraService')

const store = async (req, res) => {
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
        console.log("1. Recebi no Controller");
        return res.status(201).json(novaLeitura);
    } catch (error) {
        console.error("Erro no Controller:", error);
        return res.status(500).json({ error: "Erro interno ao processar leitura" });
    }
};

module.exports = { store };