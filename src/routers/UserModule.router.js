const express = require('express');
const router = express.Router();
const userModuleController = require('../controllers/UserModule.controller');
const { verifyToken } = require('../middlewares/jwt.middleware');

router.get('/', verifyToken, userModuleController.getUserModules);

module.exports = router;
