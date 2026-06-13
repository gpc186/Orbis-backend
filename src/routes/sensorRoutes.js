const express = require('express')
const router = express.Router()
const SensorController = require('../controllers/sensorController')
const authMiddleware = require('../middlewares/authMiddleware')
const { createCacheMiddleware } = require('../middlewares/cacheMiddleware')

const cacheGet = createCacheMiddleware()

router.post('/', authMiddleware, SensorController.store)
router.get('/', authMiddleware, cacheGet, SensorController.index)
router.get('/:id', authMiddleware, SensorController.show)
router.put('/:id', authMiddleware, SensorController.update)
router.delete('/:id', authMiddleware, SensorController.delete)

module.exports = router
