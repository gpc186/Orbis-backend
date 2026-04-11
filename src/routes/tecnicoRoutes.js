const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const UsuarioService = require('../services/usuarioService');
const router = express.Router();

router.get('/', authMiddleware, roleMiddleware("ADMIN"), UsuarioService.listAllTecnicos);
router.get('/:id', authMiddleware, roleMiddleware("ADMIN"), UsuarioService.findTecnicoById);
router.get('/:id/alertas', authMiddleware, roleMiddleware("ADMIN"), UsuarioService.findAlertasByTecnicoId);

module.exports = router;