const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const DashboardController = require('../controllers/dashboardController');
const { ADMIN_READ_ROLES } = require('../utils/authorization');
const router = express.Router();

router.get('/resumo', authMiddleware, roleMiddleware(...ADMIN_READ_ROLES), DashboardController.resume);

module.exports = router
