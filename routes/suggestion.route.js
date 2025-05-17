const express = require('express');
const router = express.Router();
const suggestionController = require('../controllers/suggestion.controller');
const calendarController = require('../controllers/calendar.controller');
const { protect } = require('../middleware/auth.middleware');
router.get('/', protect, suggestionController.getSuggestions);
router.post('/dismiss', protect, suggestionController.dismissSuggestion);
router.post('/add-to-calendar', protect, suggestionController.addSuggestionToCalendar, calendarController.createEvent);
module.exports = router;