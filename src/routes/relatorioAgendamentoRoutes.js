const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const RelatorioAgendamentoController = require("../controllers/relatorioAgendamentoController");

const router = express.Router();

router.post('/preview', authMiddleware, RelatorioAgendamentoController.preview);
router.post('/agendamentos', authMiddleware, RelatorioAgendamentoController.create);
router.get('/agendamentos', authMiddleware, RelatorioAgendamentoController.list);
router.get('/agendamentos/:id', authMiddleware, RelatorioAgendamentoController.findById);
router.patch('/agendamentos/:id', authMiddleware, RelatorioAgendamentoController.update);
router.delete('/agendamentos/:id', authMiddleware, RelatorioAgendamentoController.delete);
router.patch('/agendamentos/:id/status', authMiddleware, RelatorioAgendamentoController.updateStatus);
router.post('/agendamentos/:id/executar-agora', authMiddleware, RelatorioAgendamentoController.executeNow);
router.get('/agendamentos/:id/execucoes', authMiddleware, RelatorioAgendamentoController.listExecutions);

module.exports = router;
