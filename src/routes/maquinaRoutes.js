const express = require('express')
const router = express.Router()
const MaquinaController = require('../controllers/maquinaController')

router.post('/', MaquinaController.store)
router.get('/', MaquinaController.index)
router.get('/:id', MaquinaController.show)
router.put('/:id', MaquinaController.update)
router.delete('/:id', MaquinaController.delete)

module.exports = router