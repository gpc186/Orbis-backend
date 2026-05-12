const express = require("express");
const ContatoController = require("../controllers/emailController");
const validateContactMiddleware = require("../middlewares/validateContactMiddleware");
const contactRateLimit = require("../middlewares/contactRateLimitMiddleware");

const router = express.Router();

router.post("/", contactRateLimit({ windowMs: 60_000, maxRequests: 3 }), validateContactMiddleware, ContatoController.enviar);

module.exports = router;