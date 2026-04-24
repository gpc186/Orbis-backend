const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const AlertaController = require('../controllers/alertaController');
const router = express.Router();

router.get('/contagens/maquinas-em-alerta', authMiddleware, AlertaController.countMaquinasWithAlerta);
router.get('/contagens/ativos', authMiddleware, AlertaController.countActiveAlertas);
router.get('/contagens/hoje', authMiddleware, AlertaController.countAlertasToday);
router.get('/contagens/sem-atendimento', authMiddleware, AlertaController.countAlertaSemAtendimento);
router.get('/contagens/atendidos-hoje', authMiddleware, AlertaController.countAtendedToday);
router.get('/', authMiddleware, AlertaController.list);
router.get('/:id', authMiddleware, AlertaController.findById);

module.exports = router;
