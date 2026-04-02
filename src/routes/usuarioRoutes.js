const express = require('express');
const router = express.Router();
const UsuarioController = require("../controllers/usuarioController");
const authMiddleware = require('../middlewares/authMiddleware');


router.get('/', authMiddleware, UsuarioController.list);
router.get('/:id', authMiddleware, UsuarioController.findById);
router.post('/', authMiddleware, UsuarioController.register);
router.put('/:id', authMiddleware, UsuarioController.update);
router.delete('/:id', authMiddleware, UsuarioController.delete);

module.exports = router