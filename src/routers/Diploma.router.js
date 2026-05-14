const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const diplomaController = require('../controllers/Diploma.controller');

// ##############################################################
// FEATURE: Diploma CRUD
// ##############################################################

router.get('/:diplomaId', jwtMiddleware.verifyToken, diplomaController.getDiploma);
router.put('/:diplomaId', jwtMiddleware.verifyToken, diplomaController.updateDiploma);

// router.post('/', jwtMiddleware.verifyToken, diplomaController.createDiploma);

module.exports = router;
