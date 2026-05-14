const express = require('express');
const router = express.Router();
const prefController = require('../controllers/MatchPreference.controller');
const { verifyToken } = require('../middlewares/jwt.middleware'); 

router.get('/', verifyToken, prefController.getPreferences);
router.post('/', verifyToken, prefController.updatePreferences);

module.exports = router;
