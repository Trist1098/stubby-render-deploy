const express = require('express');
const jwtMiddleware = require('../middlewares/jwt.middleware');
const experienceController = require('../controllers/Experience.controller');

const router = express.Router();

router.get('/:userId', jwtMiddleware.verifyToken, experienceController.getByUserId);
router.post('/', jwtMiddleware.verifyToken, experienceController.create);
router.put('/:experienceId', jwtMiddleware.verifyToken, experienceController.update);
router.delete('/:experienceId', jwtMiddleware.verifyToken, experienceController.remove);

module.exports = router;
