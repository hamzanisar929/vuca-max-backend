const User = require('../models/User');
const Session = require('../models/Session');
const OpenAI = require('openai');
const { validationResult } = require('express-validator');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze chat history and generate personalized suggestions
 */
const analyzeChatAndGenerateSuggestions = async (req, res) => {
  try {
    // Validate request if it's from an API endpoint
    if (req.body && res.status) {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
    }

    const { userId } = req.body;

    // Validate userId - handle both string and ObjectId
    let userIdStr = userId;
    if (typeof userId === 'object' && userId !== null) {
      // Convert ObjectId to string if needed
      userIdStr = userId.toString();
    }

    if (!userIdStr || (typeof userIdStr === 'string' && !userIdStr.match(/^[0-9a-fA-F]{24}$/))) {
      const error = new Error('Invalid user ID');
      if (res.status) {
        return res.status(400).json({ error: 'Invalid user ID' });
      } else {
        throw error;
      }
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      const error = new Error('User not found');
      if (res.status) {
        return res.status(404).json({ error: 'User not found' });
      } else {
        throw error;
      }
    }

    // Get user's sessions (including both active and completed)
    const sessions = await Session.find({ 
      userId: userId,
      status: { $in: ['active', 'completed'] }
    }).sort({ updatedAt: -1 }).limit(5);

    if (sessions.length === 0) {
      return res.status(404).json({ error: 'No chat sessions found' });
    }

    // Convert chat history to transcript format
    let transcript = "";
    
    for (const session of sessions) {
      transcript += `=== Session ${session._id} ===\n`;
      
      for (const message of session.messages) {
        const role = message.from === 'user' ? 'User' : 'AI';
        transcript += `${role}: ${message.text}\n`;
      }
      
      transcript += '\n';
    }

    // Send transcript to OpenAI for analysis
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert conversation analyst. Analyze the provided chat transcript and return ONLY a JSON object with the following fields: topics (array of strings), sentimentScore (number between 0 and 1), complexity (string: 'beginner', 'intermediate', or 'expert'), and userType (string describing user's communication style)." 
        },
        { 
          role: "user", 
          content: `Please analyze this chat transcript and provide the JSON object as instructed:\n\n${transcript}` 
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the analysis
    const analysis = JSON.parse(analysisResponse.choices[0].message.content);

    // Get suggestions based on the analysis
    const suggestionsResponse = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are an expert coach. Based on the chat analysis, provide 3 specific and actionable suggestions to help the user improve their conversational skills. Return ONLY an array of 3 suggestion strings in JSON format like: [\"suggestion1\", \"suggestion2\", \"suggestion3\"]" 
        },
        { 
          role: "user", 
          content: `Based on this analysis, provide 3 improvement suggestions. Focus on the latest topics discussed, especially any complex or sensitive topics:\n\n${JSON.stringify(analysis)}` 
        }
      ],
      response_format: { type: "json_object" }
    });

    // Parse the suggestions
    const suggestions = JSON.parse(suggestionsResponse.choices[0].message.content);

    // Calculate total messages and average chat length
    let totalMessages = 0;
    sessions.forEach(session => {
      totalMessages += session.messages.filter(m => m.from === 'user').length;
    });

    const avgChatLength = totalMessages / sessions.length;

    // Update user metrics and suggestions
    user.metrics = {
      topics: analysis.topics,
      sentimentScore: analysis.sentimentScore,
      complexity: analysis.complexity,
      userType: analysis.userType,
      totalMessages: totalMessages,
      avgChatLength: avgChatLength,
      lastUpdated: new Date()
    };
    
    user.suggestions = Array.isArray(suggestions) ? suggestions : suggestions.suggestions;
    
    await user.save();

    // Only send a response if this is an actual API call (not a background process)
    if (res.json) {
      res.json({
        metrics: user.metrics,
        suggestions: user.suggestions
      });
    }
    
    return {
      metrics: user.metrics,
      suggestions: user.suggestions
    };
  } catch (error) {
    console.error('Error analyzing chat:', error);
    if (res.status) {
      res.status(500).json({ error: 'Error analyzing chat history' });
    }
    throw error;
  }
};

module.exports = {
  analyzeChatAndGenerateSuggestions
}; 