const express = require('express')
const router = express.Router()
const leituraController = require('../controllers/leituraController')

router.post('/', leituraController.store)
router.get('/', leituraController.index)

module.exports = router