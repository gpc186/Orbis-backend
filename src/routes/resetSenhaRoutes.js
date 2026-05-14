const express = require('express');
const ResetSenhaController = require('../controllers/resetSenhaController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/esqueci-senha', ResetSenhaController.esqueciSenha);
router.post('/validar-codigo', ResetSenhaController.validarCodigo);
router.post('/redefinir-senha', ResetSenhaController.redefinirSenha);
router.post('/solicitar-alteracao', authMiddleware, ResetSenhaController.solicitarAlteracaoSenha);
router.post('/confirmar-alteracao', authMiddleware, ResetSenhaController.confirmarAlteracaoSenha);

module.exports = router