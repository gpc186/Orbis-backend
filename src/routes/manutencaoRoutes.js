const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const ManutecaoController = require('../controllers/manutencaoController');
const router = express.Router();

router.get('/', authMiddleware, roleMiddleware("ADMIN"), ManutecaoController.list);
router.post('/', authMiddleware, roleMiddleware("ADMIN", "TECNICO"), ManutecaoController.create);
router.get('/:alertaId', authMiddleware, roleMiddleware("TECNICO"), ManutecaoController.findByAlertaId);
router.get('/:id', authMiddleware, roleMiddleware("ADMIN", "TECNICO"), ManutecaoController.findById);
router.put('/:id', authMiddleware, roleMiddleware("TECNICO"), ManutecaoController.update);

module.exports = router