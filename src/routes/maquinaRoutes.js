const express = require('express')
const router = express.Router()
const MaquinaController = require('../controllers/maquinaController')
const HistoricoIntegridadeController = require('../controllers/historicoIntegridadeController')
const authMiddleware = require('../middlewares/authMiddleware')
const { createCacheMiddleware } = require('../middlewares/cacheMiddleware')
const { uploadImagemUnica, uploadManualUnico, imagemProcessada } = require('../middlewares/uploadMiddleware')

const cacheGet = createCacheMiddleware()

router.post('/manual/preview', authMiddleware, uploadManualUnico, MaquinaController.previewManual)
router.post('/', authMiddleware, uploadManualUnico, MaquinaController.store)
router.get('/', authMiddleware, cacheGet, MaquinaController.index)
router.get('/:id/predicao-alertas', authMiddleware, MaquinaController.predicaoAlertas)
router.get('/:id/predicao-risco', authMiddleware, MaquinaController.predicaoRisco)
router.get('/:id/historico-integridade', authMiddleware, HistoricoIntegridadeController.listByMaquina)
router.get('/:id', authMiddleware, MaquinaController.show)
router.put('/:id/foto', authMiddleware, uploadImagemUnica, imagemProcessada, MaquinaController.updateFoto)
router.put('/:id/manual', authMiddleware, uploadManualUnico, MaquinaController.updateManual)
router.put('/:id', authMiddleware, MaquinaController.update)
router.delete('/:id', authMiddleware, MaquinaController.delete)

module.exports = router
