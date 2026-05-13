const express = require('express');
const ResetSenhaController = require('../controllers/resetSenhaController');
const router = express.Router();

router.post('/esqueci-senha', ResetSenhaController.resetarSenha);

module.exports = router