const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Converts speech to text using OpenAI's Whisper API
 * @param {Buffer|string} audioData - Audio buffer or path to audio file
 * @param {string} fileType - The file type (mp3, wav, etc.)
 * @returns {Promise<string>} - Transcribed text
 */
async function speechToText(audioData, fileType = 'mp3') {
  try {
    let file;
    
    if (typeof audioData === 'string' && fs.existsSync(audioData)) {
      // If audioData is a file path
      file = fs.createReadStream(audioData);
    } else if (Buffer.isBuffer(audioData)) {
      // If audioData is a buffer, write it to a temporary file
      const tempFilePath = `/tmp/audio-${Date.now()}.${fileType}`;
      fs.writeFileSync(tempFilePath, audioData);
      file = fs.createReadStream(tempFilePath);
      
      // Clean up temp file after processing
      setTimeout(() => {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }, 5000);
    } else {
      throw new Error('Invalid audio data format');
    }

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    return transcription.text;
  } catch (error) {
    console.error('Error in speech-to-text:', error);
    throw new Error('Failed to convert speech to text');
  }
}

module.exports = {
  speechToText
}; 