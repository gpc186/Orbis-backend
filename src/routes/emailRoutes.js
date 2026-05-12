const express = require("express");
const ContatoController = require("../controllers/emailController");
const validateContactMiddleware = require("../middlewares/validateContactMiddleware");
const contactRateLimit = require("../middlewares/contactRateLimitMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/", contactRateLimit({ windowMs: 60_000, maxRequests: 3 }), validateContactMiddleware, ContatoController.enviar);
router.post("/enviar-agora", authMiddleware, roleMiddleware("ADMIN"), ContatoController.enviarRelatorioAgora);
module.exports = router;