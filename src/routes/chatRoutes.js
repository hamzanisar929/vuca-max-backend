const express = require('express');
const { analyzeChatAndGenerateSuggestions } = require('../controllers/chatMetricsController');
const { auth } = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Validation middleware
const analyzeValidation = [
  body('userId').isMongoId()
];

// Routes
router.post('/analyze', analyzeValidation, analyzeChatAndGenerateSuggestions);

module.exports = router; 