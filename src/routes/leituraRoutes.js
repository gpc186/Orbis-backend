const express = require('express')
const router = express.Router()
const leituraController = require('../controllers/leituraController')

router.post('/', leituraController.store)

module.exports = router