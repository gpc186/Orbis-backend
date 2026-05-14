const express = require("express");
const validateContactMiddleware = require("../middlewares/validateContactMiddleware");
const contactRateLimit = require("../middlewares/contactRateLimitMiddleware");
const EmailController = require("../controllers/emailController");

const router = express.Router();

router.post("/contato", contactRateLimit({ windowMs: 60_000, maxRequests: 3 }), validateContactMiddleware, EmailController.enviarContato);

module.exports = router;