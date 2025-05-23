const express = require('express');
const multer = require('multer');
const { transcribe, speak } = require('../controllers/voiceController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Apply auth middleware to all routes
router.use(auth);

// Routes
router.post('/transcribe', upload.single('audio'), transcribe);
router.post('/speak', speak);

module.exports = router; 