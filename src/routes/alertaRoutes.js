const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const AlertaController = require('../controllers/alertaController');
const { ROLES } = require('../utils/authorization');
const router = express.Router();

router.get('/resumo', authMiddleware, AlertaController.summary);
router.get('/eventos', authMiddleware, AlertaController.listEventos);
router.get('/', authMiddleware, AlertaController.list);
router.get('/:id/eventos', authMiddleware, AlertaController.listEventosByAlertaId);
router.post('/:id/comentarios', authMiddleware, roleMiddleware(ROLES.ADMIN, ROLES.TECNICO), AlertaController.createComentario);
router.get('/:id', authMiddleware, AlertaController.findById);

module.exports = router;
