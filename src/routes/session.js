const express = require('express');
const { startSession, sendMessage, sendMessageStream, voiceConversation, pauseSession, endSession } = require('../controllers/sessionController');
const { auth } = require('../middleware/auth');
const { body } = require('express-validator');

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Validation middleware
const messageValidation = [
  body('text').trim().notEmpty().escape(),
  body('voiceInput').optional().isBoolean()
];

// Routes
router.post('/start', startSession);
router.post('/:sessionId/message', messageValidation, sendMessage);
router.post('/:sessionId/message/stream', messageValidation, sendMessageStream);
router.post('/:sessionId/voice', messageValidation, voiceConversation);
router.post('/:sessionId/pause', pauseSession);
router.post('/:sessionId/end', endSession);

module.exports = router; 