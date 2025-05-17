const CalendarEvent = require('../models/calendar-event.model');
exports.getEvents = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const events = await CalendarEvent.find({ userId });
        const formattedEvents = events.map(event => ({
            id: event._id,
            title: event.title,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            backgroundColor: event.backgroundColor,
            borderColor: event.borderColor,
            extendedProps: {
                type: event.type,
                description: event.description
            }
        }));
        
        return res.status(200).json(formattedEvents);
    } catch (error) {
        console.error('Error getting calendar events:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể lấy các sự kiện lịch',
            error: error.message
        });
    }
};
exports.createEvent = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        let { 
            title, 
            start, 
            end, 
            allDay, 
            backgroundColor, 
            borderColor, 
            type, 
            description 
        } = req.body;
        if (!title || !start) {
            return res.status(400).json({
                success: false,
                message: 'Tiêu đề và thời gian bắt đầu là bắt buộc'
            });
        }
        if (allDay && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            if (startDate.toDateString() === endDate.toDateString()) {
                endDate.setDate(endDate.getDate() + 1);
                end = endDate.toISOString();
            }
        }
        const newEvent = new CalendarEvent({
            userId,
            title,
            start,
            end,
            allDay,
            backgroundColor,
            borderColor,
            type: type || 'study-session',
            description: description || ''
        });
        const savedEvent = await newEvent.save();
        
        return res.status(201).json({
            success: true,
            message: 'Đã tạo sự kiện thành công',
            id: savedEvent._id,
            title: savedEvent.title,
            start: savedEvent.start,
            end: savedEvent.end,
            allDay: savedEvent.allDay,
            backgroundColor: savedEvent.backgroundColor,
            borderColor: savedEvent.borderColor,
            type: savedEvent.type,
            description: savedEvent.description
        });
    } catch (error) {
        console.error('Error creating calendar event:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể tạo sự kiện lịch',
            error: error.message
        });
    }
};
exports.updateEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.user.id || req.user._id;
        let { 
            title, 
            start, 
            end, 
            allDay, 
            backgroundColor, 
            borderColor, 
            type, 
            description 
        } = req.body;
        const event = await CalendarEvent.findById(eventId);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sự kiện'
            });
        }
        if (event.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền truy cập vào sự kiện này'
            });
        }
        if (allDay && start && end) {
            const startDate = new Date(start);
            const endDate = new Date(end);
            if (startDate.toDateString() === endDate.toDateString()) {
                endDate.setDate(endDate.getDate() + 1);
                end = endDate.toISOString();
            }
        }
        const updatedEvent = await CalendarEvent.findByIdAndUpdate(
            eventId,
            {
                title,
                start,
                end,
                allDay,
                backgroundColor,
                borderColor,
                type: type || event.type,
                description: description || event.description,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        return res.status(200).json({
            success: true,
            message: 'Đã cập nhật sự kiện thành công',
            id: updatedEvent._id,
            title: updatedEvent.title,
            start: updatedEvent.start,
            end: updatedEvent.end,
            allDay: updatedEvent.allDay,
            backgroundColor: updatedEvent.backgroundColor,
            borderColor: updatedEvent.borderColor,
            type: updatedEvent.type,
            description: updatedEvent.description
        });
    } catch (error) {
        console.error('Error updating calendar event:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể cập nhật sự kiện lịch',
            error: error.message
        });
    }
};
exports.deleteEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.user.id || req.user._id;
        const event = await CalendarEvent.findById(eventId);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sự kiện'
            });
        }
        if (event.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền truy cập vào sự kiện này'
            });
        }
        await CalendarEvent.findByIdAndDelete(eventId);
        
        return res.status(200).json({
            success: true,
            message: 'Đã xóa sự kiện thành công'
        });
    } catch (error) {
        console.error('Error deleting calendar event:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể xóa sự kiện lịch',
            error: error.message
        });
    }
};
exports.getEventById = async (req, res) => {
    try {
        const eventId = req.params.id;
        const userId = req.user.id || req.user._id;
        const event = await CalendarEvent.findById(eventId);
        
        if (!event) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy sự kiện'
            });
        }
        if (event.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền truy cập vào sự kiện này'
            });
        }
        
        return res.status(200).json({
            success: true,
            id: event._id,
            title: event.title,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            backgroundColor: event.backgroundColor,
            borderColor: event.borderColor,
            type: event.type,
            description: event.description
        });
    } catch (error) {
        console.error('Error getting calendar event by ID:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể lấy thông tin sự kiện lịch',
            error: error.message
        });
    }
};
exports.getEventsByDateRange = async (req, res) => {
    try {
        const { start, end } = req.query;
        const userId = req.user.id || req.user._id;
        
        if (!start || !end) {
            return res.status(400).json({
                success: false,
                message: 'Start and end dates are required'
            });
        }
        const startDate = new Date(start);
        const endDate = new Date(end);
        const events = await CalendarEvent.find({
            userId,
            $or: [
                { start: { $gte: startDate, $lte: endDate } },
                { end: { $gte: startDate, $lte: endDate } },
                { 
                    start: { $lte: startDate },
                    end: { $gte: endDate }
                }
            ]
        }).sort({ start: 1 });
        const formattedEvents = events.map(event => ({
            id: event._id,
            title: event.title,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            backgroundColor: event.backgroundColor,
            borderColor: event.borderColor,
            extendedProps: {
                type: event.type,
                description: event.description
            }
        }));
        
        return res.status(200).json(formattedEvents);
    } catch (error) {
        console.error('Error getting events by date range:', error);
        return res.status(500).json({
            success: false,
            message: 'Could not retrieve events for the specified date range',
            error: error.message
        });
    }
};
exports.getEventStats = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const stats = await CalendarEvent.aggregate([
            { $match: { userId: userId } },
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
        const totalEvents = await CalendarEvent.countDocuments({ userId });
        const formattedStats = stats.map(stat => {
            let typeLabel;
            switch (stat._id) {
                case 'study-session': typeLabel = 'Buổi học'; break;
                case 'assignment': typeLabel = 'Bài tập'; break;
                case 'exam-prep': typeLabel = 'Ôn thi'; break;
                case 'exam': typeLabel = 'Kỳ thi'; break;
                case 'group-study': typeLabel = 'Học nhóm'; break;
                case 'study-break': typeLabel = 'Giải lao'; break;
                default: typeLabel = 'Khác';
            }
            
            return {
                type: stat._id,
                typeLabel,
                count: stat.count,
                percentage: Math.round((stat.count / totalEvents) * 100),
                totalHours: parseFloat(stat.totalDuration.toFixed(1))
            };
        });
        
        return res.status(200).json({
            success: true,
            totalEvents,
            stats: formattedStats
        });
    } catch (error) {
        console.error('Error getting calendar event statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể lấy thống kê sự kiện lịch',
            error: error.message
        });
    }
};