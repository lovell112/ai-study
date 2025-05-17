const { GoogleGenerativeAI } = require('@google/generative-ai');
const { CohereClient } = require('cohere-ai');
const Chat = require('../models/chat.model');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const cohere = new CohereClient({ 
  token: process.env.COHERE_API_KEY 
});

exports.chatWithAI = async (req, res) => {
    try {
        const { message, model, chatId } = req.body;
        const userId = req.user._id || req.user.id;
        if (!message) {
          return res.status(400).json({ success: false, message: 'Message is required' });
        }
        
        if (!userId) {
          return res.status(401).json({ success: false, message: 'User authentication required' });
        }
  
      let response;
  
      try {
        switch (model) {
          case 'cohere-command':
            response = await chatWithCohere(message);
            break;
          case 'gemini-pro':
          default:
            response = await chatWithGemini(message);
        }
      } catch (error) {
        console.error("Model error:", error.message || error);
        return res.status(500).json({
          success: false,
          message: 'AI model unavailable. Please try again later or select a different model.',
          error: error.message
        });
      }
      try {
        let chat;
        if (chatId) {
          chat = await Chat.findById(chatId);
          
          if (!chat) {
            chat = new Chat({
              title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
              userId: userId,
              model: response.model,
              messages: []
            });
          } else {
          }
          if (chat._id && chat.userId.toString() !== userId.toString()) {
            return res.status(403).json({
              success: false,
              message: 'Unauthorized access to chat'
            });
          }
          chat.messages.push(
            { role: 'user', content: message },
            { role: 'assistant', content: response.text }
          );
          chat.updatedAt = Date.now();
        } else {
          chat = new Chat({
            title: message.substring(0, 30) + (message.length > 30 ? '...' : ''),
            userId: userId,
            model: response.model,
            messages: [
              { role: 'user', content: message },
              { role: 'assistant', content: response.text }
            ]
          });
        }
        await chat.save();
        response.chatId = chat._id;
      } catch (dbError) {
        console.error("Database error:", dbError);
      }
  
      return res.status(200).json({
        success: true,
        message: 'AI response generated successfully',
        data: response
      });
  
    } catch (error) {
      console.error('ChatWithAI Controller Error:', error.message || error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate AI response',
        error: error.message
      });
    }
  };
exports.getChatHistory = async (req, res) => {
    try {
      const userId = req.user.id || req.user._id;
      const chats = await Chat.find({ userId }).sort({ updatedAt: -1 }).select('title model createdAt updatedAt');
      return res.status(200).json({
        success: true,
        data: chats
      });
    } catch (error) {
      console.error('Get Chat History Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve chat history',
        error: error.message
      });
    }
  };
  
  exports.getChatById = async (req, res) => {
    try {
      const chatId = req.params.id;
      const userId = req.user.id || req.user._id;
      const chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
      if (chat.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to chat'
        });
      }
      
      return res.status(200).json({
        success: true,
        data: chat
      });
    } catch (error) {
      console.error('Get Chat By ID Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve chat',
        error: error.message
      });
    }
  };
  
  exports.deleteChat = async (req, res) => {
    try {
      const chatId = req.params.id;
      const userId = req.user.id || req.user._id;
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }
      if (chat.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized access to chat'
        });
      }
      await Chat.findByIdAndDelete(chatId);
      
      return res.status(200).json({
        success: true,
        message: 'Chat deleted successfully'
      });
    } catch (error) {
      console.error('Delete Chat Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete chat',
        error: error.message
      });
    }
  };

  exports.getRecentChats = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const limit = parseInt(req.query.limit) || 5;
        
        const chats = await Chat.find({ userId })
            .sort({ updatedAt: -1 })
            .limit(limit)
            .select('title messages createdAt updatedAt');
        
        return res.status(200).json({
            success: true,
            data: chats
        });
    } catch (error) {
        console.error('Error retrieving recent chats:', error);
        return res.status(500).json({
            success: false,
            message: 'Could not retrieve recent chats',
            error: error.message
        });
    }
};
async function chatWithCohere(message) {
  try {
    const cohereResponse = await cohere.generate({
      prompt: `As a helpful educational assistant, answer the following question: ${message}`,
      model: 'command',
      maxTokens: 500,
      temperature: 0.7,
      k: 0,
      stopSequences: [],
      returnLikelihoods: 'NONE'
    });

    return {
      text: cohereResponse.generations[0].text.trim(),
      model: 'Cohere Command'
    };
  } catch (error) {
    console.error("Cohere API error:", error.message || error);
    throw new Error(`Cohere API error: ${error.message}`);
  }
}

async function chatWithGemini(message) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(message);
    return {
      text: result.response.text(),
      model: 'Gemini 1.5'
    };
  } catch (error) {
    console.error("Gemini 1.5 error:", error);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
      const result = await model.generateContent(message);
      return {
        text: result.response.text(),
        model: 'Gemini 1.0'
      };
    } catch (secondError) {
      console.error("Gemini 1.0 fallback error:", secondError);
      throw new Error("Google Gemini API is currently unavailable.");
    }
  }
}