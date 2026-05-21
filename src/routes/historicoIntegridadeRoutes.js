const express = require('express');
const router = express.Router();
const HistoricoIntegridadeController = require('../controllers/historicoIntegridadeController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, HistoricoIntegridadeController.store);
router.get('/', authMiddleware, HistoricoIntegridadeController.index);
router.get('/:id', authMiddleware, HistoricoIntegridadeController.show);

module.exports = router;
