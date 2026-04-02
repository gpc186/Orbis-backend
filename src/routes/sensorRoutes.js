const express = require('express')
const router = express.Router()
const SensorController = require('../controllers/sensorController')
const authMiddleware = require('../middlewares/authMiddleware')

router.post('/', authMiddleware, SensorController.store)
router.get('/', authMiddleware, SensorController.index)
router.get('/:id', authMiddleware, SensorController.show)
router.put('/:id', authMiddleware, SensorController.update)
router.delete('/:id', authMiddleware, SensorController.delete)

module.exports = router