const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const TecnicoController = require('../controllers/tecnicoController');
const router = express.Router();

router.get('/', authMiddleware, roleMiddleware("ADMIN"), TecnicoController.list);
router.get('/:id', authMiddleware, roleMiddleware("ADMIN"), TecnicoController.findById);
router.get('/:id/alertas', authMiddleware, roleMiddleware("ADMIN"), TecnicoController.findAlertasByTecnico);

module.exports = router;