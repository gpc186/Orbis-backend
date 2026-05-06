const express = require('express')
const router = express.Router()
const MaquinaController = require('../controllers/maquinaController')
const authMiddleware = require('../middlewares/authMiddleware')
const { uploadImagemUnica, imagemProcessada } = require('../middlewares/uploadMiddleware')

router.post('/', authMiddleware, MaquinaController.store)
router.get('/', authMiddleware, MaquinaController.index)
router.get('/:id', authMiddleware, MaquinaController.show)
router.put('/:id/foto', authMiddleware, uploadImagemUnica, imagemProcessada, MaquinaController.updateFoto)
router.put('/:id', authMiddleware, MaquinaController.update)
router.delete('/:id', authMiddleware, MaquinaController.delete)

module.exports = router