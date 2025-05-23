const Session = require('../models/Session');
const User = require('../models/User');
const { getAIResponse } = require('../utils/openai');
const { textToSpeech } = require('../utils/textToSpeech');
const { analyzeChatAndGenerateSuggestions } = require('./chatMetricsController');

const startSession = async (req, res) => {
  try {
    const session = new Session({
      userId: req.user._id,
      startTime: new Date(),
      status: 'active'
    });

    await session.save();
    res.status(201).json(session);
  } catch (error) {
    res.status(500).json({ error: 'Error starting session' });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text, voiceInput = false } = req.body;

    console.log('Received message request:', {
      sessionId,
      text,
      voiceInput,
      userId: req.user._id
    });

    const session = await Session.findById(sessionId);
    if (!session) {
      console.log('Session not found:', sessionId);
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'completed') {
      console.log('Session already completed:', sessionId);
      return res.status(400).json({ error: 'Session is already completed' });
    }

    // Get user data for personalized responses
    const user = await User.findById(req.user._id);
    if (!user) {
      console.log('User not found:', req.user._id);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get previous messages for context
    const context = session.messages.slice(-5).map(msg => msg.text);
    console.log('Context messages:', context);

    // Get AI response with metrics
    console.log('Calling getAIResponse...');
    const aiResponse = await getAIResponse(text, context, user);
    console.log('AI Response received:', aiResponse);

    // Add user message and AI response to session
    session.messages.push(
      {
        from: 'user',
        text,
        voiceInput,
        timestamp: new Date()
      },
      {
        from: 'ai',
        text: aiResponse.text,
        voiceInput: false,
        timestamp: new Date()
      }
    );

    // Update session metrics
    session.metrics = {
      ...session.metrics,
      ...aiResponse.metrics
    };

    await session.save();
    console.log('Session saved successfully');

    // Update user XP
    user.xp += calculateXPGain(aiResponse.metrics);
    user.level = calculateLevel(user.xp);
    await user.save();
    console.log('User XP and level updated');

    // Count user messages in current session
    const userMessageCount = session.messages.filter(msg => msg.from === 'user').length;
    
    // Re-analyze after every 3 user messages in the current session
    if (userMessageCount % 3 === 0) {
      // Run chat analysis in the background
      setTimeout(async () => {
        try {
          await analyzeChatAndGenerateSuggestions(
            { body: { userId: user._id } }, 
            { 
              json: () => {},
              status: () => ({ json: () => {} })
            }
          );
          console.log(`Updated analysis for user ${user._id} after ${userMessageCount} messages`);
        } catch (error) {
          console.error('Error updating chat analysis during conversation:', error);
        }
      }, 0);
    }

    // Get the latest user suggestions if available
    const latestUser = await User.findById(user._id);
    let suggestions = [];
    if (latestUser && latestUser.suggestions && latestUser.suggestions.length > 0) {
      suggestions = latestUser.suggestions;
    }

    res.json({
      aiResponse: aiResponse.text,
      metrics: aiResponse.metrics,
      userLevel: user.level,
      userXP: user.xp,
      suggestions
    });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    res.status(500).json({ error: 'Error processing message' });
  }
};

// Streaming version of sendMessage
const sendMessageStream = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text, voiceInput = false } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Session is already completed' });
    }

    // Get user data for personalized responses
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get previous messages for context
    const context = session.messages.slice(-5).map(msg => msg.text);

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';

    // Get AI response with streaming
    const aiResponse = await getAIResponse(text, context, user, (chunk) => {
      // Send each chunk to the client
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      fullResponse += chunk;
    });

    // Add user message and AI response to session
    session.messages.push(
      {
        from: 'user',
        text,
        voiceInput,
        timestamp: new Date()
      },
      {
        from: 'ai',
        text: fullResponse,
        voiceInput: false,
        timestamp: new Date()
      }
    );

    // Update session metrics
    session.metrics = {
      ...session.metrics,
      ...aiResponse.metrics
    };

    await session.save();

    // Update user XP
    user.xp += calculateXPGain(aiResponse.metrics);
    user.level = calculateLevel(user.xp);
    await user.save();

    // Count user messages in current session
    const userMessageCount = session.messages.filter(msg => msg.from === 'user').length;
    
    // Re-analyze after every 3 user messages in the current session
    if (userMessageCount % 3 === 0) {
      // Run chat analysis in the background
      setTimeout(async () => {
        try {
          await analyzeChatAndGenerateSuggestions(
            { body: { userId: user._id } }, 
            { 
              json: () => {},
              status: () => ({ json: () => {} })
            }
          );
          console.log(`Updated analysis for user ${user._id} after ${userMessageCount} messages`);
        } catch (error) {
          console.error('Error updating chat analysis during conversation:', error);
        }
      }, 0);
    }

    // Get the latest user suggestions if available
    const latestUser = await User.findById(user._id);
    let suggestions = [];
    if (latestUser && latestUser.suggestions && latestUser.suggestions.length > 0) {
      suggestions = latestUser.suggestions;
    }

    // Send final response with metrics and suggestions
    res.write(`data: ${JSON.stringify({ 
      done: true,
      metrics: aiResponse.metrics,
      userLevel: user.level,
      userXP: user.xp,
      suggestions
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error in sendMessageStream:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing message stream' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Error processing message stream' })}\n\n`);
      res.end();
    }
  }
};

// Real-time voice conversation function
const voiceConversation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text, voiceInput = true, voice = 'nova' } = req.body;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Session is already completed' });
    }

    // Get user data for personalized responses
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get previous messages for context
    const context = session.messages.slice(-5).map(msg => msg.text);

    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullResponse = '';
    let sentenceBuffer = '';
    const sentenceEndingRegex = /[.!?]+[\s\n]+/g;

    // Get AI response with streaming
    const aiResponse = await getAIResponse(text, context, user, (chunk) => {
      // Send each text chunk to the client for real-time display
      res.write(`data: ${JSON.stringify({ 
        chunk,
        type: 'text'
      })}\n\n`);
      
      fullResponse += chunk;
      sentenceBuffer += chunk;
      
      // Check if we have a complete sentence to convert to speech
      const match = sentenceEndingRegex.exec(sentenceBuffer);
      if (match) {
        const sentence = sentenceBuffer.substring(0, match.index + match[0].length);
        sentenceBuffer = sentenceBuffer.substring(match.index + match[0].length);
        
        // Convert sentence to speech asynchronously
        (async () => {
          try {
            const audioBuffer = await textToSpeech(sentence, voice);
            // Send audio data as base64 encoded string
            res.write(`data: ${JSON.stringify({
              type: 'audio',
              audio: audioBuffer.toString('base64'),
              text: sentence
            })}\n\n`);
          } catch (error) {
            console.error('Error generating speech:', error);
          }
        })();
      }
    });

    // Process any remaining text in the buffer
    if (sentenceBuffer.trim()) {
      try {
        const audioBuffer = await textToSpeech(sentenceBuffer, voice);
        res.write(`data: ${JSON.stringify({
          type: 'audio',
          audio: audioBuffer.toString('base64'),
          text: sentenceBuffer
        })}\n\n`);
      } catch (error) {
        console.error('Error generating speech for remaining text:', error);
      }
    }

    // Add user message and AI response to session
    session.messages.push(
      {
        from: 'user',
        text,
        voiceInput: true,
        timestamp: new Date()
      },
      {
        from: 'ai',
        text: fullResponse,
        voiceInput: true,
        timestamp: new Date()
      }
    );

    // Update session metrics
    session.metrics = {
      ...session.metrics,
      ...aiResponse.metrics
    };

    await session.save();

    // Update user XP
    user.xp += calculateXPGain(aiResponse.metrics);
    user.level = calculateLevel(user.xp);
    await user.save();

    // Send final response with metrics
    res.write(`data: ${JSON.stringify({ 
      done: true,
      fullText: fullResponse,
      metrics: aiResponse.metrics
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Error in voiceConversation:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error processing voice conversation' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Error processing voice conversation' })}\n\n`);
      res.end();
    }
  }
};

const pauseSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'paused';
    await session.save();

    res.json({ message: 'Session paused successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error pausing session' });
  }
};

const endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    session.status = 'completed';
    session.endTime = new Date();
    await session.save();

    // Update user rating
    const user = await User.findById(req.user._id);
    if (user) {
      const userSessions = await Session.find({ userId: user._id, status: 'completed' });
      const totalRating = userSessions.reduce((sum, s) => sum + s.rating, 0);
      user.rating = Math.round(totalRating / userSessions.length);
      await user.save();

      // Trigger chat analysis if the user has at least 3 completed sessions
      if (userSessions.length >= 3) {
        // Use setTimeout to run this asynchronously without blocking the response
        setTimeout(async () => {
          try {
            await analyzeChatAndGenerateSuggestions(
              { body: { userId: user._id } }, 
              { 
                json: () => {},
                status: () => ({ json: () => {} })
              }
            );
          } catch (error) {
            console.error('Error during automatic chat analysis:', error);
          }
        }, 0);
      }
    }

    res.json({
      message: 'Session ended successfully',
      sessionRating: session.rating,
      userRating: user?.rating
    });
  } catch (error) {
    res.status(500).json({ error: 'Error ending session' });
  }
};

// Helper functions
function calculateXPGain(metrics) {
  // Base XP for each message
  const baseXP = 10;
  
  // Bonus XP based on metrics (up to 10 additional XP)
  const metricsBonus = Math.round(
    (metrics.engagement + metrics.coherence + metrics.responseTime) / 30
  );
  
  return baseXP + metricsBonus;
}

function calculateLevel(xp) {
  // Simple level calculation:
  // Level 1: 0-99 XP
  // Level 2: 100-299 XP
  // Level 3: 300-599 XP
  // Level 4: 600-999 XP
  // Level 5: 1000+ XP
  const levels = [0, 100, 300, 600, 1000];
  let level = 1;
  
  for (let i = 1; i < levels.length; i++) {
    if (xp >= levels[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  
  return level;
}

module.exports = {
  startSession,
  sendMessage,
  sendMessageStream,
  voiceConversation,
  pauseSession,
  endSession
}; 