const express = require('express')
const router = express.Router()
const leituraController = require('../controllers/leituraController')
const espMiddleware = require('../middlewares/espMiddleware')
const authMiddleware = require('../middlewares/authMiddleware')

router.post('/', espMiddleware, leituraController.store)
router.get('/', authMiddleware, leituraController.index)

module.exports = router