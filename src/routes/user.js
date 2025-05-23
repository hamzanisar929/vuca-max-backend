const express = require('express');
const { getProfile, requestProfileUpdate, verifyProfileUpdate, checkVerificationToken } = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router();

// Validation middleware
const profileUpdateValidation = [
  body('username').optional().trim().isLength({ min: 3 }).escape(),
  body('newPassword').optional().isLength({ min: 6 })
];

// Routes
router.get('/profile', auth, getProfile);
router.post('/update-profile', auth, profileUpdateValidation, requestProfileUpdate);
router.post('/verify-profile-update', verifyProfileUpdate);
router.get('/verify-token/:token', checkVerificationToken);

module.exports = router; 