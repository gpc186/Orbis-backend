const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const AlertaController = require('../controllers/alertaController');
const router = express.Router();

router.get('/resumo', authMiddleware, AlertaController.summary);
router.get('/', authMiddleware, AlertaController.list);
router.get('/:id', authMiddleware, AlertaController.findById);

module.exports = router;
