const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const User = require('../models/user.model');
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/avatars'));
    },
    filename: function(req, file, cb) {
        const userId = req.user.id;
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ chấp nhận tệp JPG, PNG và WebP'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: fileFilter
});
router.post('/follow', requireAuth, userController.followUser);
router.post('/save-post', requireAuth, userController.savePost);

router.post('/update-profile', requireAuth, async (req, res) => {
    try {
        await new Promise(resolve => setTimeout(resolve, 100));
        await userController.updateProfile(req, res);
    } catch (error) {
        console.error('Unexpected error in update-profile route:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi không mong muốn khi xử lý yêu cầu'
        });
    }
});
router.post('/update-avatar', requireAuth, userController.uploadAvatar, userController.updateAvatar);
router.post('/change-password', requireAuth, userController.changePassword);
router.get('/activity-history', requireAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const result = await userController.getUserActivity(req.user.id, page, limit);
        
        res.json({
            success: true,
            activities: result.activities,
            pagination: result.pagination
        });
    } catch (error) {
        console.error('Error fetching activity history:', error);
        res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi tải lịch sử hoạt động'
        });
    }
});
router.get('/me', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        return res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                phone: user.phone || '',
                avatar: user.avatar || '',
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;
