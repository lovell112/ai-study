const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { isAuthenticated } = require('../middleware/auth');
router.post('/chat', isAuthenticated, aiController.chatWithAI);
router.get('/chats', isAuthenticated, aiController.getChatHistory);
router.get('/chats/:id', isAuthenticated, aiController.getChatById);
router.delete('/chats/:id', isAuthenticated, aiController.deleteChat);
module.exports = router;