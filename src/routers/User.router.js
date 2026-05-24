const express = require('express');
const router = express.Router();
const userController = require('../controllers/User.controller');
const bcryptMiddleware = require('../middlewares/bcrypt.middleware');
const jwtMiddleware = require('../middlewares/jwt.middleware');
const upload = require('../middlewares/upload');

// ##############################################################
// FEATURE: Auth & User Profile
// ##############################################################

router.post(
  '/login',
  userController.login,
  bcryptMiddleware.comparePassword,
  jwtMiddleware.generateToken,
  jwtMiddleware.sendToken,
);
router.post(
  '/register',
  bcryptMiddleware.hashPassword,
  userController.register,
  jwtMiddleware.generateToken,
  jwtMiddleware.sendToken,
);
router.put('/onboarding', jwtMiddleware.verifyToken, userController.completeOnboarding);
router.post(
  '/profile-picture',
  jwtMiddleware.verifyToken,
  upload.image.single('profilePic'),
  userController.uploadProfilePicture,
);
router.post(
  '/profile-banner',
  jwtMiddleware.verifyToken,
  upload.image.single('profileBanner'),
  userController.uploadProfileBanner,
);
router.get('/me', jwtMiddleware.verifyToken, userController.getMe);
router.get('/public/:userId', jwtMiddleware.verifyToken, userController.getPublicUser);
router.get('/search', jwtMiddleware.verifyToken, userController.searchStudents);
router.get('/viewProfile/:friendId', jwtMiddleware.verifyToken, userController.viewProfile);
router.put('/update-profile', jwtMiddleware.verifyToken, userController.updateProfile);
router.put('/change-password', jwtMiddleware.verifyToken, userController.changePassword);

module.exports = router;
