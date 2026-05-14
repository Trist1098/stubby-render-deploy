const express = require('express');
const router = express.Router();
const languageController = require('../controllers/Language.controller');
const { verifyToken } = require('../middlewares/jwt.middleware');

router.get('/', verifyToken, languageController.getAllLanguages);

module.exports = router;
