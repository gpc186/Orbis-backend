const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const DashboardController = require('../controllers/dashboardController');
const router = express.Router();

router.get('/resumo', authMiddleware, roleMiddleware("ADMIN"), DashboardController.resume);

module.exports = router