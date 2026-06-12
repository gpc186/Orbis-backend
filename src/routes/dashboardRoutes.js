const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const DashboardController = require('../controllers/dashboardController');
const { createDashboardCacheMiddleware } = require('../middlewares/cacheMiddleware');
const { ADMIN_READ_ROLES } = require('../utils/authorization');
const router = express.Router();
const cacheDashboard = createDashboardCacheMiddleware();

router.get('/resumo', authMiddleware, roleMiddleware(...ADMIN_READ_ROLES), cacheDashboard, DashboardController.resume);
router.get('/completo', authMiddleware, roleMiddleware(...ADMIN_READ_ROLES), cacheDashboard, DashboardController.complete);

module.exports = router
