const { speechToText } = require('../utils/speechToText');
const { textToSpeech } = require('../utils/textToSpeech');

/**
 * Transcribe speech to text
 */
const transcribe = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const fileBuffer = req.file.buffer;
    const fileType = req.file.originalname.split('.').pop().toLowerCase();
    
    // Get transcript
    const transcript = await speechToText(fileBuffer, fileType);

    res.json({
      transcript,
      success: true
    });
  } catch (error) {
    console.error('Error in transcribe:', error);
    res.status(500).json({ error: 'Error transcribing audio' });
  }
};

/**
 * Generate speech from text
 */
const speak = async (req, res) => {
  try {
    const { text, voice = 'nova' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    // Generate speech
    const audioBuffer = await textToSpeech(text, voice);

    // Set headers for audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="speech.mp3"');
    
    // Send audio buffer
    res.send(audioBuffer);
  } catch (error) {
    console.error('Error in speak:', error);
    res.status(500).json({ error: 'Error generating speech' });
  }
};

module.exports = {
  transcribe,
  speak
}; 