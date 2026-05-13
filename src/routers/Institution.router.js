const express = require('express');
const router = express.Router();
const jwtMiddleware = require('../middlewares/jwt.middleware');
const institutionController = require('../controllers/Institution.controller');

// ##############################################################
// FEATURE: Institution CRUD
// ##############################################################

router.get('/:institutionId', jwtMiddleware.verifyToken, institutionController.getInstitution);
router.put('/:institutionId', jwtMiddleware.verifyToken, institutionController.updateInstitution);

// router.post('/', jwtMiddleware.verifyToken, institutionController.createInstitution);

module.exports = router;
