const OpenAI = require('openai');
require('dotenv').config();

// Debug log to check if API key is loaded
console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getAIResponse(userInput, context = [], user = null, streamCallback = null) {
  const startTime = Date.now();
  
  try {
    console.log('Starting AI response generation with input:', userInput);
    // Create system message with personalization if user has metrics
    let systemMessage = "You are a helpful AI assistant engaging in conversation with a user.";
    
    if (user && user.metrics) {
      // Add personalization based on user metrics
      systemMessage += ` The user's conversation style is ${user.metrics.complexity} level, `;
      systemMessage += `and they typically discuss topics like: ${user.metrics.topics.join(', ')}.`;
      
      // Include suggestions if available
      if (user.suggestions && user.suggestions.length > 0) {
        systemMessage += ` Based on their conversation history, consider these coaching suggestions: ${user.suggestions.join('; ')}.`;
      }
    }

    let fullResponse = '';
    let metrics = null;

    if (streamCallback) {
      // Streaming mode
      console.log('Using streaming mode');
      const stream = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemMessage },
          ...context.map(msg => ({ role: "user", content: msg })),
          { role: "user", content: userInput }
        ],
        temperature: 0.7,
        max_tokens: 150,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          streamCallback(content);
        }
      }

      // Calculate metrics after streaming is complete
      const responseTime = Date.now() - startTime;
      metrics = {
        engagement: calculateEngagement(fullResponse),
        coherence: calculateCoherence(userInput, fullResponse),
        responseTime: normalizeResponseTime(responseTime)
      };

      return {
        text: fullResponse,
        metrics
      };
    } else {
      // Non-streaming mode (original implementation)
      console.log('Using non-streaming mode');
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemMessage },
          ...context.map(msg => ({ role: "user", content: msg })),
          { role: "user", content: userInput }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const responseTime = Date.now() - startTime;
      const response = completion.choices[0]?.message?.content || "I apologize, but I couldn't generate a response.";
      
      metrics = {
        engagement: calculateEngagement(response),
        coherence: calculateCoherence(userInput, response),
        responseTime: normalizeResponseTime(responseTime)
      };

      return {
        text: response,
        metrics
      };
    }
  } catch (error) {
    console.error('Error in AI response:', error);
    // Log more details about the error
    if (error.response) {
      console.error('OpenAI API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    throw new Error('Failed to get AI response');
  }
}

// Helper functions to calculate metrics
function calculateEngagement(response) {
  // Simple engagement metric based on response length and variety
  const words = response.split(' ').length;
  const uniqueWords = new Set(response.toLowerCase().split(' ')).size;
  const engagement = Math.min(100, (uniqueWords / words) * 100 + words / 2);
  return Math.round(engagement);
}

function calculateCoherence(input, response) {
  // Simple coherence metric based on common words
  const inputWords = new Set(input.toLowerCase().split(' '));
  const responseWords = response.toLowerCase().split(' ');
  const commonWords = responseWords.filter(word => inputWords.has(word)).length;
  const coherence = Math.min(100, (commonWords / responseWords.length) * 100 + 50);
  return Math.round(coherence);
}

function normalizeResponseTime(responseTime) {
  // Convert response time to a 0-100 scale where:
  // < 1000ms = 100
  // > 5000ms = 0
  const score = Math.max(0, Math.min(100, (1 - (responseTime - 1000) / 4000) * 100));
  return Math.round(score);
}

module.exports = {
  getAIResponse
}; 