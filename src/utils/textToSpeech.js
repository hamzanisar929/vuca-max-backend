const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Converts text to speech using OpenAI's TTS API
 * @param {string} text - The text to convert to speech
 * @param {string} voice - The voice to use (alloy, echo, fable, onyx, nova, shimmer)
 * @returns {Promise<Buffer>} - Audio buffer
 */
async function textToSpeech(text, voice = 'nova') {
  try {
    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voice,
      input: text,
    });

    // Get buffer from the response
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error) {
    console.error('Error in text-to-speech:', error);
    throw new Error('Failed to convert text to speech');
  }
}

module.exports = {
  textToSpeech
}; 