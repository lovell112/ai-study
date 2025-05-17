const mongoose = require('mongoose');

const suggestionHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    start: {
        type: Date,
        required: true
    },
    end: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        enum: ['study-session', 'assignment', 'exam-prep', 'group-study', 'study-break'],
        default: 'study-session'
    },
    topic: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    priority: {
        type: Number,
        default: 3, 
        min: 1,
        max: 5
    },
    suggestedAt: {
        type: Date,
        default: Date.now
    },
    dismissed: {
        type: Boolean,
        default: false
    },
    addedToCalendar: {
        type: Boolean,
        default: false
    },
    uniqueKey: {
        type: String,
        index: true
    }
}, {
    timestamps: true
});
suggestionHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SuggestionHistory', suggestionHistorySchema);