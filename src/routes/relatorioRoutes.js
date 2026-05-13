const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const RelatorioController = require("../controllers/relatorioController");

const router = express.Router();

router.post("/enviar-agora", authMiddleware, RelatorioController.enviarAgora);

module.exports = router;