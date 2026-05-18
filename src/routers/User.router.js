const express = require('express');
const router = express.Router();
const userController = require('../controllers/User.controller');
const bcryptMiddleware = require('../middlewares/bcrypt.middleware');
const jwtMiddleware = require('../middlewares/jwt.middleware');

// ##############################################################
// FEATURE: Auth & User Profile
// ##############################################################

router.post("/login", userController.login, bcryptMiddleware.comparePassword, jwtMiddleware.generateToken, jwtMiddleware.sendToken);
router.post("/register", bcryptMiddleware.hashPassword, userController.register, jwtMiddleware.generateToken, jwtMiddleware.sendToken);
router.put("/onboarding", jwtMiddleware.verifyToken, userController.completeOnboarding);

module.exports = router;
