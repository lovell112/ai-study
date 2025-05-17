const mongoose = require('mongoose');
const calendarEventSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true 
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    start: {
        type: Date,
        required: true
    },
    end: {
        type: Date
    },
    allDay: {
        type: Boolean,
        default: false
    },
    backgroundColor: {
        type: String,
        default: '#4e73df' 
    },
    borderColor: {
        type: String,
        default: '#4e73df'
    },
    type: {
        type: String,
        enum: ['study-session', 'assignment', 'exam-prep', 'exam', 'group-study', 'study-break'],
        default: 'study-session'
    },
    description: {
        type: String,
        default: '',
        trim: true
    },
    location: {
        type: String,
        trim: true,
        default: ''
    },
    completed: {
        type: Boolean,
        default: false
    },
    reminder: {
        enabled: {
            type: Boolean,
            default: false
        },
        time: {
            type: Date
        }
    },
    recurrence: {
        enabled: {
            type: Boolean,
            default: false
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly', 'monthly', 'none'],
            default: 'none'
        },
        daysOfWeek: {
            type: [Number], 
            default: []
        },
        endDate: {
            type: Date
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true 
});

calendarEventSchema.index({ userId: 1, start: 1 });
calendarEventSchema.index({ userId: 1, end: 1 });
calendarEventSchema.index({ userId: 1, type: 1 });
calendarEventSchema.pre('save', function(next) {
    if (this.end && this.start > this.end) {
        const err = new Error('Thời gian kết thúc phải sau thời gian bắt đầu');
        return next(err);
    }
    next();
});
calendarEventSchema.pre('findOneAndUpdate', function() {
    this.set({ updatedAt: new Date() });
});
calendarEventSchema.pre('save', function(next) {
    if (!this.isModified('backgroundColor')) {
        const colorMap = {
            'study-session': '#4e73df',  
            'assignment': '#36b9cc',     
            'exam-prep': '#f6c23e',      
            'exam': '#e74a3b',           
            'group-study': '#1cc88a',    
            'study-break': '#858796'    
        };
        
        this.backgroundColor = colorMap[this.type] || colorMap['study-session'];
        this.borderColor = this.backgroundColor;
    }
    next();
});
calendarEventSchema.virtual('durationHours').get(function() {
    if (!this.start || !this.end) return 0;
    
    const durationMs = this.end - this.start;
    return Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10; 
});
calendarEventSchema.statics.getEventsInRange = async function(userId, startDate, endDate) {
    return this.find({
        userId: userId,
        $or: [
            { start: { $gte: startDate, $lte: endDate } },
            { end: { $gte: startDate, $lte: endDate } },
            { 
                start: { $lte: startDate },
                end: { $gte: endDate }
            }
        ]
    }).sort({ start: 1 });
};
calendarEventSchema.statics.getStudyStats = async function(userId, startDate, endDate) {
    const match = { userId: userId };
    if (startDate && endDate) {
        match.$or = [
            { start: { $gte: startDate, $lte: endDate } },
            { end: { $gte: startDate, $lte: endDate } },
            { start: { $lte: startDate }, end: { $gte: endDate } }
        ];
    }
    
    return this.aggregate([
        { $match: match },
        { $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalDuration: {
                $sum: {
                    $cond: [
                        { $and: [ 
                            { $ne: ["$start", null] }, 
                            { $ne: ["$end", null] } 
                        ]},
                        { $divide: [
                            { $subtract: ["$end", "$start"] },
                            3600000 
                        ]},
                        0
                    ]
                }
            }
        }},
        { $sort: { _id: 1 } }
    ]);
};

const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);

module.exports = CalendarEvent;