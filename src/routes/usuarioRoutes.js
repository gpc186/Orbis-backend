const express = require('express');
const router = express.Router();
const UsuarioController = require("../controllers/usuarioController");
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');


router.get('/', authMiddleware, roleMiddleware("ADMIN"), UsuarioController.list);
router.get('/:id', authMiddleware, roleMiddleware("ADMIN"), UsuarioController.findById);
router.post('/', authMiddleware, roleMiddleware("ADMIN"), UsuarioController.register);
router.put('/:id', authMiddleware, roleMiddleware("ADMIN"), UsuarioController.update);
router.delete('/:id', authMiddleware, roleMiddleware("ADMIN"), UsuarioController.delete);

module.exports = router
