const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const TecnicoController = require('../controllers/tecnicoController');
const router = express.Router();

router.get('/', authMiddleware, TecnicoController.list);
router.get('/:id', authMiddleware, TecnicoController.findById);
router.get('/:id/alertas', authMiddleware, TecnicoController.findAlertasByTecnico);

module.exports = router;