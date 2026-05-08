const express = require("express");
const router = express.Router();
const ContatoController = require("../controllers/contatoController");

router.post("/", ContatoController.send);

module.exports = router;