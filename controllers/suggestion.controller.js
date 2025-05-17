const { GoogleGenerativeAI } = require('@google/generative-ai');
const CalendarEvent = require('../models/calendar-event.model');
const SuggestionHistory = require('../models/suggestion-history.model');
const Chat = require('../models/chat.model'); 
const User = require('../models/user.model'); 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.getSuggestions = async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const user = await User.findById(userId);
        const activeSuggestions = await SuggestionHistory.find({
            userId,
            dismissed: false,
            addedToCalendar: false,
            suggestedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }).sort({ priority: -1 }).limit(5);
        
        if (activeSuggestions.length >= 3) {
            return res.status(200).json({
                success: true,
                suggestions: activeSuggestions.map(suggestion => ({
                    id: suggestion._id,
                    title: suggestion.title,
                    topic: suggestion.topic,
                    text: suggestion.text,
                    start: suggestion.start,
                    end: suggestion.end,
                    type: suggestion.type,
                    priority: suggestion.priority
                }))
            });
        }
        const now = new Date();
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        
        const upcomingEvents = await CalendarEvent.find({
            userId,
            start: { $gte: now }
        }).sort({ start: 1 }).limit(10);
        const careerChats = await Chat.find({
            userId,
            $or: [
                { title: { $regex: /nghề nghiệp|định hướng|lộ trình|roadmap|career/i } },
                { 'messages.content': { $regex: /nghề nghiệp|định hướng|lộ trình|roadmap|career/i } }
            ]
        }).sort({ createdAt: -1 }).limit(3);
        let careerContext = '';
        if (careerChats && careerChats.length > 0) {
            careerChats.forEach(chat => {
                if (chat.messages && chat.messages.length > 0) {
                    const aiMessages = chat.messages.filter(msg => msg.role === 'assistant');
                    if (aiMessages.length > 0) {
                        careerContext += aiMessages[0].content + ' ';
                    }
                }
            });
        }
        const dismissedSuggestions = await SuggestionHistory.find({
            userId,
            dismissed: true
        }).select('uniqueKey topic');
        
        const dismissedTopics = dismissedSuggestions.map(s => s.topic);
        const dismissedKeys = dismissedSuggestions.map(s => s.uniqueKey);
        const newSuggestions = await generateMultipleSuggestions(
            userId, 
            upcomingEvents, 
            careerContext, 
            dismissedTopics,
            dismissedKeys,
            5 - activeSuggestions.length 
        );
        const savedSuggestions = await SuggestionHistory.insertMany(newSuggestions);
        const allSuggestions = [...activeSuggestions, ...savedSuggestions];
        allSuggestions.sort((a, b) => b.priority - a.priority);
        const topSuggestions = allSuggestions.slice(0, 5);
        
        return res.status(200).json({
            success: true,
            suggestions: topSuggestions.map(suggestion => ({
                id: suggestion._id,
                title: suggestion.title,
                topic: suggestion.topic,
                text: suggestion.text,
                start: suggestion.start,
                end: suggestion.end,
                type: suggestion.type,
                priority: suggestion.priority
            }))
        });
    } catch (error) {
        console.error('Lỗi khi tạo gợi ý học tập:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể tạo gợi ý học tập',
            error: error.message
        });
    }
};
exports.dismissSuggestion = async (req, res) => {
    try {
        const { suggestionId } = req.body;
        const userId = req.user.id || req.user._id;
        
        if (!suggestionId) {
            return res.status(400).json({
                success: false,
                message: 'Cần ID của gợi ý'
            });
        }
        const suggestion = await SuggestionHistory.findById(suggestionId);
        
        if (!suggestion) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy gợi ý'
            });
        }
        if (suggestion.userId.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền bỏ qua gợi ý này'
            });
        }
        suggestion.dismissed = true;
        await suggestion.save();
        
        return res.status(200).json({
            success: true,
            message: 'Đã bỏ qua gợi ý thành công'
        });
    } catch (error) {
        console.error('Lỗi khi bỏ qua gợi ý:', error);
        return res.status(500).json({
            success: false,
            message: 'Không thể bỏ qua gợi ý',
            error: error.message
        });
    }
};
exports.addSuggestionToCalendar = async (req, res, next) => {
    try {
        const { id } = req.body;
        const userId = req.user.id || req.user._id;
        
        if (id) {
            await SuggestionHistory.findOneAndUpdate(
                { _id: id, userId },
                { addedToCalendar: true }
            );
        }
        next();
    } catch (error) {
        console.error('Lỗi khi xử lý gợi ý cho lịch:', error);
        next();
    }
};
async function analyzeUserMajor(userId) {
    try {
        const userChats = await Chat.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10);
            
        if (!userChats || userChats.length === 0) {
            return {
                detected: false,
                major: null,
                subjects: [],
                keywords: []
            };
        }

        let chatContent = '';
        userChats.forEach(chat => {
            if (chat.messages && chat.messages.length > 0) {
                const userMessages = chat.messages.filter(msg => msg.role === 'user');
                userMessages.forEach(msg => {
                    chatContent += msg.content + ' ';
                });
            }
        });
        if (chatContent.trim().length > 0) {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            
            const prompt = `Phân tích nội dung chat sau đây và xác định:
1. Chuyên ngành/ngành học chính của người dùng
2. Các môn học/khóa học cụ thể mà họ đang học
3. Các từ khóa liên quan đến lĩnh vực học tập của họ

Nội dung chat:
${chatContent.substring(0, 3000)}

Trả lời CHÍNH XÁC theo định dạng JSON như sau:
{
    "detected": true/false (đã phát hiện được chuyên ngành hay chưa),
    "major": "tên chuyên ngành",
    "subjects": ["môn học 1", "môn học 2",...],
    "keywords": ["từ khóa 1", "từ khóa 2",...]
}`;

            const result = await model.generateContent(prompt);
            let responseText = result.response.text();
            
            try {
                let jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            } catch (error) {
                console.error('Lỗi khi phân tích phản hồi AI về chuyên ngành:', error);
            }
        }
        
        return {
            detected: false,
            major: null,
            subjects: [],
            keywords: []
        };
    } catch (error) {
        console.error('Lỗi khi phân tích chuyên ngành của người dùng:', error);
        return {
            detected: false,
            major: null,
            subjects: [],
            keywords: []
        };
    }
}
async function generateMultipleSuggestions(userId, upcomingEvents, careerContext, dismissedTopics, dismissedKeys, count = 5) {
    const now = new Date();
    const dayNames = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    const today = dayNames[now.getDay()];
    const currentHour = now.getHours();
    let eventContext = 'Không có sự kiện sắp tới';
    if (upcomingEvents.length > 0) {
        eventContext = upcomingEvents.map(event => {
            const date = new Date(event.start);
            return `- ${event.title} (${dayNames[date.getDay()]}, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`;
        }).join('\n');
    }
    const suggestedTimeSlots = [];
    if (currentHour < 20) {
        const slot1Start = new Date(now);
        slot1Start.setHours(currentHour + 1, 0, 0, 0);
        const slot1End = new Date(slot1Start);
        slot1End.setHours(slot1Start.getHours() + 1);
        suggestedTimeSlots.push({ start: slot1Start, end: slot1End });
    }
    if (currentHour < 17) {
        const slot2Start = new Date(now);
        slot2Start.setHours(19, 0, 0, 0);
        const slot2End = new Date(slot2Start);
        slot2End.setHours(20, 30);
        suggestedTimeSlots.push({ start: slot2Start, end: slot2End });
    }
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const slot3Start = new Date(tomorrow);
    slot3Start.setHours(8, 0, 0, 0);
    const slot3End = new Date(slot3Start);
    slot3End.setHours(9, 30);
    suggestedTimeSlots.push({ start: slot3Start, end: slot3End });
    const slot4Start = new Date(tomorrow);
    slot4Start.setHours(15, 0, 0, 0);
    const slot4End = new Date(slot4Start);
    slot4End.setHours(16, 30);
    suggestedTimeSlots.push({ start: slot4Start, end: slot4End });
    const weekend = new Date(now);
    const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
    weekend.setDate(weekend.getDate() + daysUntilSaturday);
    weekend.setHours(10, 0, 0, 0);
    const weekendEnd = new Date(weekend);
    weekendEnd.setHours(12, 0);
    suggestedTimeSlots.push({ start: weekend, end: weekendEnd });
    
    try {
        const userProfile = await analyzeUserMajor(userId);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        let careerPrompt = '';
        if (careerContext && careerContext.trim() !== '') {
            careerPrompt = `
Thông tin về định hướng nghề nghiệp và lộ trình học tập của người dùng:
${careerContext.substring(0, 2000)}`;
        }
        let dismissedTopicsPrompt = '';
        if (dismissedTopics && dismissedTopics.length > 0) {
            dismissedTopicsPrompt = `
QUAN TRỌNG: Người dùng đã bỏ qua các chủ đề sau, KHÔNG ĐƯỢC gợi ý các chủ đề này nữa:
${dismissedTopics.join(', ')}`;
        }
        let majorPrompt = '';
        if (userProfile.detected && userProfile.major) {
            majorPrompt = `
THÔNG TIN QUAN TRỌNG VỀ NGƯỜI DÙNG:
- Chuyên ngành: ${userProfile.major}
- Các môn học hiện tại: ${userProfile.subjects.join(', ')}
- Từ khóa liên quan đến lĩnh vực học tập: ${userProfile.keywords.join(', ')}

CÁC GỢI Ý PHẢI PHÙ HỢP VỚI CHUYÊN NGÀNH ${userProfile.major.toUpperCase()} - KHÔNG GỢI Ý CÁC CHỦ ĐỀ NGOÀI CHUYÊN NGÀNH NÀY!`;
        }
        
        const prompt = `Là trợ lý học tập AI, hãy tạo ra ${count} gợi ý học tập cụ thể và khác nhau dựa trên dữ liệu sau:
- Hôm nay là ${today}
- Thời gian hiện tại là ${now.toLocaleTimeString('vi-VN')}
- Sự kiện sắp tới trong lịch:
${eventContext}
${careerPrompt}
${majorPrompt}
${dismissedTopicsPrompt}

Tạo ${count} gợi ý học tập khác nhau với các yếu tố sau:
1. Chủ đề học tập CỤ THỂ và PHÙ HỢP với chuyên ngành của người dùng 
2. Mô tả ngắn gọn nhưng thuyết phục tại sao nên học chủ đề này vào thời điểm được gợi ý
3. Mức độ ưu tiên từ 1-5 (với 5 là cao nhất) dựa trên tầm quan trọng của chủ đề với định hướng nghề nghiệp

Trả lời với CHÍNH XÁC một mảng JSON gồm ${count} đối tượng có cấu trúc như sau:
[
  {
    "title": "tiêu đề buổi học",
    "topic": "chủ đề cụ thể",
    "type": "study-session",
    "text": "lời gợi ý thuyết phục",
    "priority": số từ 1-5
  }
]`;

        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        let jsonMatch = responseText.match(/\[[\s\S]*\]/);
        let suggestionDataArray = [];
        
        if (jsonMatch) {
            try {
                suggestionDataArray = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error('Lỗi khi phân tích phản hồi AI thành JSON:', parseError);
                if (userProfile.detected && userProfile.major) {
                    suggestionDataArray = Array(count).fill({
                        title: `Buổi học ${userProfile.major}`,
                        topic: `Ôn tập kiến thức ${userProfile.major}`,
                        type: "study-session",
                        text: `Hãy dành thời gian ôn tập lại kiến thức gần đây về ${userProfile.major} để củng cố hiểu biết của bạn.`,
                        priority: 3
                    });
                } else {
                    suggestionDataArray = Array(count).fill({
                        title: "Buổi học tập trung",
                        topic: "Ôn tập kiến thức",
                        type: "study-session",
                        text: "Hãy dành thời gian ôn tập lại kiến thức gần đây để củng cố hiểu biết của bạn.",
                        priority: 3
                    });
                }
            }
        } else {
            if (userProfile.detected && userProfile.major) {
                suggestionDataArray = Array(count).fill({
                    title: `Buổi học ${userProfile.major}`,
                    topic: `Ôn tập kiến thức ${userProfile.major}`,
                    type: "study-session",
                    text: `Hãy dành thời gian ôn tập lại kiến thức gần đây về ${userProfile.major} để củng cố hiểu biết của bạn.`,
                    priority: 3
                });
            } else {
                suggestionDataArray = Array(count).fill({
                    title: "Buổi học tập trung",
                    topic: "Ôn tập kiến thức",
                    type: "study-session",
                    text: "Hãy dành thời gian ôn tập lại kiến thức gần đây để củng cố hiểu biết của bạn.",
                    priority: 3
                });
            }
        }
        const suggestions = [];
        for (let i = 0; i < Math.min(suggestionDataArray.length, suggestedTimeSlots.length); i++) {
            const data = suggestionDataArray[i];
            const timeSlot = suggestedTimeSlots[i];
            const uniqueKey = `${userId}-${data.topic}-${data.type}`.replace(/\s+/g, '-').toLowerCase();
            if (dismissedKeys.includes(uniqueKey)) {
                continue;
            }
            
            suggestions.push({
                userId,
                title: data.title,
                topic: data.topic,
                start: timeSlot.start,
                end: timeSlot.end,
                type: data.type || "study-session",
                text: data.text,
                priority: data.priority || 3,
                uniqueKey: uniqueKey
            });
        }
        
        return suggestions;
    } catch (error) {
        console.error('Lỗi khi tạo gợi ý từ AI:', error);
        return [{
            userId,
            title: "Buổi ôn tập kiến thức",
            topic: "Ôn tập tổng hợp",
            start: suggestedTimeSlots[0].start,
            end: suggestedTimeSlots[0].end,
            type: "study-session",
            text: "Hãy dành thời gian ôn tập lại những kiến thức gần đây và chuẩn bị cho những bài học sắp tới.",
            priority: 3,
            uniqueKey: `${userId}-on-tap-tong-hop-${Date.now()}`
        }];
    }
}