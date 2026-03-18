const express = require('express')
const router = express.Router()
const leituraRoutes = require('./leituraRoutes')

router.use('/leituras', leituraRoutes)

module.exports = router