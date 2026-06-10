const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const ManutecaoController = require('../controllers/manutencaoController');
const { ADMIN_READ_ROLES, ROLES } = require('../utils/authorization');
const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(...ADMIN_READ_ROLES, ROLES.TECNICO), ManutecaoController.list);
router.post('/', authMiddleware, roleMiddleware(ROLES.ADMIN, ROLES.TECNICO), ManutecaoController.create);
router.get('/alerta/:id', authMiddleware, roleMiddleware(...ADMIN_READ_ROLES, ROLES.TECNICO), ManutecaoController.findByAlertaId);
router.get('/:id', authMiddleware, roleMiddleware(...ADMIN_READ_ROLES, ROLES.TECNICO), ManutecaoController.findById);
router.put('/:id', authMiddleware, roleMiddleware(ROLES.TECNICO), ManutecaoController.update);

module.exports = router
