const express = require('express');
const router = express.Router();
const moduleController = require('../controllers/Module.controller');
const { verifyToken } = require('../middlewares/jwt.middleware');

router.get('/', verifyToken, moduleController.getAllModules);
router.get('/diploma/:diplomaId', verifyToken, moduleController.getModulesByDiploma);

module.exports = router;
