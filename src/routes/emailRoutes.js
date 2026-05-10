const express = require("express");
const router = express.Router();
const ContatoController = require("../controllers/emailController");

router.post("/", ContatoController.send);

module.exports = router;