const express = require('express')
const router = express.Router()
const SensorController = require('../controllers/sensorController')

router.post('/', SensorController.store)
router.get('/', SensorController.index)
router.get('/:id', SensorController.show)
router.put('/:id', SensorController.update)
router.delete('/:id', SensorController.delete)

module.exports = router