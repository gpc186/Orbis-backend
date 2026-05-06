const express = require('express')
const router = express.Router()
const authMiddleware = require('../middlewares/authMiddleware');
const { PerfilController } = require('../controllers/perfilController');
const { uploadImagemUnica, imagemProcessada } = require('../middlewares/uploadMiddleware');

router.get('/', authMiddleware, PerfilController.getPerfil);
router.put('/foto', authMiddleware, uploadImagemUnica, imagemProcessada, PerfilController.updateFoto);
router.put('/', authMiddleware, PerfilController.updatePerfil);
router.post('/device-token', authMiddleware, PerfilController.setOneSignalId);

module.exports = router;