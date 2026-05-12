const express = require("express");
const DashboardAiController = require("../controllers/dashboardAiController");
const authMiddleware = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/perguntar", authMiddleware, DashboardAiController.perguntar);

module.exports = router;