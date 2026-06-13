const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const AlertaController = require('../controllers/alertaController');
const { createCacheMiddleware } = require('../middlewares/cacheMiddleware');
const { ROLES } = require('../utils/authorization');
const router = express.Router();
const cacheGet = createCacheMiddleware();

router.get('/resumo', authMiddleware, AlertaController.summary);
router.get('/eventos', authMiddleware, AlertaController.listEventos);
router.get('/', authMiddleware, cacheGet, AlertaController.list);
router.get('/:id/eventos', authMiddleware, AlertaController.listEventosByAlertaId);
router.post('/:id/comentarios', authMiddleware, roleMiddleware(ROLES.ADMIN, ROLES.TECNICO), AlertaController.createComentario);
router.get('/:id', authMiddleware, AlertaController.findById);

module.exports = router;
