const express = require('express');
const { register, login, createAdmin, logout } = require('../controllers/authController');
const { body } = require('express-validator');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const registerValidation = [
  body('username').trim().isLength({ min: 3 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
];

const adminValidation = [
  ...registerValidation,
  body('adminSecret').exists()
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', auth, logout);
router.post('/create-admin', adminValidation, createAdmin);

module.exports = router; 