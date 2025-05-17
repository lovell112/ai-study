const User = require('../models/user.model');
const Activity = require('../models/activity.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const UPLOAD_DIR = path.join(__dirname, '../public/uploads/avatars');
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOAD_DIR);
    },
    filename: function (req, file, cb) {
        const userId = req.user.id;
        const fileExt = path.extname(file.originalname);
        const fileName = `avatar-${userId}-${uuidv4()}${fileExt}`;
        cb(null, fileName);
    }
});

const fileFilter = (req, file, cb) => {
    if (ALLOWED_FORMATS.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Định dạng tệp không được hỗ trợ. Vui lòng sử dụng JPG, PNG hoặc WebP.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: fileFilter
});
async function processAvatar(filePath, userId) {
    try {
        const outputFilePath = path.join(UPLOAD_DIR, `avatar-${userId}-optimized.webp`);
        await sharp(filePath)
            .resize(400, 400, { 
                fit: 'cover',
                position: 'center'
            })
            .webp({ quality: 80 })
            .toFile(outputFilePath);
        fs.unlinkSync(filePath);
        
        return `/uploads/avatars/${path.basename(outputFilePath)}`;
    } catch (error) {
        console.error('Lỗi xử lý avatar:', error);
        return null;
    }
}
exports.uploadAvatar = upload.single('avatar');
exports.updateAvatar = async (req, res) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập lại để tiếp tục'
            });
        }
        
        let avatarUrl = null;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin người dùng'
            });
        }
        if (req.body && req.body.avatarType === 'default') {
            const randomSeed = Date.now();
            avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=256&seed=${randomSeed}`;
        } 
        else if (req.file) {
            const uploadedFilePath = req.file.path;
            const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const outputFilePath = path.join(UPLOAD_DIR, `avatar-${userId}-${uniqueId}-optimized.webp`);
            await sharp(uploadedFilePath)
                .resize(400, 400, { 
                    fit: 'cover',
                    position: 'center'
                })
                .webp({ quality: 80 })
                .toFile(outputFilePath);
            fs.unlinkSync(uploadedFilePath);
            avatarUrl = `/uploads/avatars/${path.basename(outputFilePath)}?v=${uniqueId}`;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Không tìm thấy thông tin avatar'
            });
        }
        if (user.avatar && user.avatar.startsWith('/uploads/')) {
            try {
                const oldAvatarPath = path.join(__dirname, '../public', user.avatar.split('?')[0]);
                if (fs.existsSync(oldAvatarPath)) {
                    fs.unlinkSync(oldAvatarPath);
                }
            } catch (error) {
                console.error('Error deleting old avatar:', error);
            }
        }
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { avatar: avatarUrl },
            { new: true }
        ).select('-password');
        await logActivity(userId, 'Cập nhật avatar', 'Thay đổi ảnh đại diện thành công', true, req);
        
        return res.status(200).json({
            success: true,
            message: 'Cập nhật ảnh đại diện thành công',
            user: updatedUser
        });
    } catch (error) {
        console.error('Error updating avatar:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi cập nhật ảnh đại diện'
        });
    }
};

const ongoingOperations = new Map();

async function logActivity(userId, action, details, success, req) {
    const operationKey = `${userId}-${action}-${Date.now()}`;
    if (ongoingOperations.has(operationKey)) {
        return null;
    }
    ongoingOperations.set(operationKey, true);
    
    try {
        const activity = new Activity({
            userId,
            action,
            details: details || '',
            ipAddress: req.ip || 'unknown',
            userAgent: req.headers ? req.headers['user-agent'] : 'unknown',
            success
        });
        await activity.save();
        
        return activity;
    } catch (error) {
        console.error('[ERROR] Failed to log activity:', error);
        return null;
    } finally {
        setTimeout(() => {
            ongoingOperations.delete(operationKey);
        }, 5000); 
    }
}

exports.updateProfile = async (req, res) => {
    const requestId = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    
    try {
        const { name, username, email, phone } = req.body;
        const userId = req.user?.id;
        
        if (!userId) {
            console.error(`[${requestId}] Missing user ID in request`);
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập lại để tiếp tục'
            });
        }

        if (!name || !username || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin'
            });
        }

        const currentUser = await User.findById(userId);
        if (!currentUser) {
            console.error(`[${requestId}] User not found: ${userId}`);
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy thông tin người dùng'
            });
        }
        
        if (
            currentUser.name === name && 
            currentUser.username === username && 
            currentUser.email === email && 
            currentUser.phone === phone
        ) {
            return res.json({
                success: true,
                message: 'Không có thông tin nào được thay đổi'
            });
        }

        if (currentUser.username !== username) {
            const existingUser = await User.findOne({ 
                username: username,
                _id: { $ne: userId }
            });
            
            if (existingUser) {
                
                await logActivity(userId, 'Cập nhật thông tin cá nhân', 'Tên đăng nhập đã được sử dụng', false, req);
                
                return res.status(400).json({
                    success: false,
                    message: 'Tên đăng nhập đã được sử dụng'
                });
            }
        }
        
        if (currentUser.email !== email) {
            const existingEmail = await User.findOne({ 
                email: email,
                _id: { $ne: userId }
            });
            
            if (existingEmail) {
                await logActivity(userId, 'Cập nhật thông tin cá nhân', 'Email đã được sử dụng', false, req);
                return res.status(400).json({
                    success: false,
                    message: 'Email đã được sử dụng'
                });
            }
        }
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { 
                name, 
                username, 
                email, 
                phone 
            },
            { new: true }
        );
        const activityDetails = `Thông tin đã được cập nhật: ${JSON.stringify({name, username, email, phone})}`;
        const activityLog = await logActivity(userId, 'Cập nhật thông tin cá nhân', activityDetails, true, req);

        const token = jwt.sign({
            id: updatedUser._id.toString(),
            name: updatedUser.name,
            username: updatedUser.username,
            email: updatedUser.email,
            phone: updatedUser.phone || ''
        }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' });

        return res.json({
            success: true,
            message: 'Cập nhật thông tin thành công',
            requestId, 
            token,
            user: {
                id: updatedUser._id.toString(),
                name: updatedUser.name,
                username: updatedUser.username,
                email: updatedUser.email,
                phone: updatedUser.phone || ''
            }
        });
    } catch (error) {
        console.error(`[${requestId}] Error updating profile:`, error);
        
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi cập nhật thông tin: ' + error.message
        });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user.id;
        let activityLogged = false;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng điền đầy đủ thông tin'
            });
        }

        if (newPassword !== confirmPassword) {
            await logActivity(userId, 'Đổi mật khẩu', 'Mật khẩu mới không khớp', false, req);
            activityLogged = true;
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới không khớp'
            });
        }

        if (newPassword.length < 6) {
            await logActivity(userId, 'Đổi mật khẩu', 'Mật khẩu mới phải có ít nhất 6 ký tự', false, req);
            activityLogged = true;
            return res.status(400).json({
                success: false,
                message: 'Mật khẩu mới phải có ít nhất 6 ký tự'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            await logActivity(userId, 'Đổi mật khẩu', 'Mật khẩu hiện tại không đúng', false, req);
            activityLogged = true;
            return res.status(401).json({
                success: false,
                message: 'Mật khẩu hiện tại không đúng'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await User.findByIdAndUpdate(
            userId,
            { password: hashedPassword }
        );

        if (!activityLogged) {
            await logActivity(userId, 'Đổi mật khẩu', null, true, req);
        }

        return res.json({
            success: true,
            message: 'Đổi mật khẩu thành công'
        });
    } catch (error) {
        console.error('Error changing password:', error);
        if (req.user && req.user.id) {
            await logActivity(req.user.id, 'Đổi mật khẩu', error.message, false, req);
        }
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi đổi mật khẩu'
        });
    }
};

exports.getUserActivity = async (userId, page = 1, limit = 10) => {
    try {
        if (!userId) {
            console.warn('No user ID provided to getUserActivity');
            return { activities: [], pagination: { total: 0, page: 1, pages: 1, limit } };
        }
        
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        
        const skip = (page - 1) * limit;
        
        const total = await Activity.countDocuments({ userId });
        
        const activities = await Activity.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        const pages = Math.ceil(total / limit) || 1;
        
        const formattedActivities = activities.map(activity => {
            let details = activity.details || '';
            if (details && details.startsWith('{') && details.endsWith('}')) {
                try {
                    const jsonDetails = JSON.parse(details);
                    if (jsonDetails) {
                        details = Object.entries(jsonDetails)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(', ');
                    }
                } catch (e) {
                }
            }
            
            return {
                action: activity.action,
                timestamp: new Date(activity.createdAt).toLocaleString('vi-VN'),
                timestampValue: activity.createdAt.getTime(),
                success: activity.success,
                details: details
            };
        });
        
        return {
            activities: formattedActivities,
            pagination: {
                total,
                page,
                pages,
                limit
            }
        };
    } catch (error) {
        console.error('Error fetching user activity:', error);
        return { activities: [], pagination: { total: 0, page: 1, pages: 1, limit } };
    }
};

exports.logLoginActivity = async (userId, success, details, req) => {
    try {
        await logActivity(userId, 'Đăng nhập', details, success, req);
    } catch (error) {
        console.error('Error logging login activity:', error);
    }
};

exports.getUserProfile = async (req, res, username) => {
    try {
        const profileUser = await User.findOne({ username })
            .select('-password')
            .populate('followers', 'name username avatar')
            .populate('following', 'name username avatar');

        if (!profileUser) {
            return res.status(404).render('pages/404', {
                message: 'Không tìm thấy người dùng',
                user: req.user
            });
        }
        const isFollowing = req.user && 
            profileUser.followers.some(follower => 
                follower._id.toString() === req.user.id
            );
        const { Post } = require('../models/discussion.model');
        const posts = await Post.find({ author: profileUser._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('author', 'name username avatar')
            .populate('category', 'name slug')
            .populate('hashtags', 'name')
            .lean();
        if (req.user) {
            posts.forEach(post => {
                post.isLiked = post.likes && 
                    post.likes.some(like => like.toString() === req.user.id);
            });
        }
        const postCount = await Post.countDocuments({ author: profileUser._id });
        let savedPosts = [];
        if (req.user && req.user.id === profileUser._id.toString()) {
            if (req.user.savedPosts && req.user.savedPosts.length > 0) {
                savedPosts = await Post.find({ _id: { $in: req.user.savedPosts } })
                    .sort({ createdAt: -1 })
                    .populate('author', 'name username avatar')
                    .lean();
            }
        }

        if (req.user) {
            const currentUser = await User.findById(req.user.id);
            const followersWithStatus = profileUser.followers.map(follower => {
                const followerObj = follower.toObject ? follower.toObject() : follower;
                followerObj.isFollowing = currentUser.following.some(
                    followingId => followingId.toString() === follower._id.toString()
                );
                return followerObj;
            });
            const followingWithStatus = profileUser.following.map(following => {
                const followingObj = following.toObject ? following.toObject() : following;
                followingObj.isFollowing = true; 
                return followingObj;
            });
            const profileData = profileUser.toObject();
            profileData.postCount = postCount;
            profileData.followers = followersWithStatus;
            profileData.following = followingWithStatus;
            
            res.render('pages/profile', {
                profileUser: profileData,
                posts,
                savedPosts,
                followers: followersWithStatus,
                following: followingWithStatus,
                isFollowing,
                hasMorePosts: postCount > posts.length,
                user: req.user
            });
        } else {
            const profileData = profileUser.toObject();
            profileData.postCount = postCount;
            
            res.render('pages/profile', {
                profileUser: profileData,
                posts,
                savedPosts,
                followers: profileUser.followers || [],
                following: profileUser.following || [],
                isFollowing: false,
                hasMorePosts: postCount > posts.length,
                user: req.user
            });
        }
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).render('pages/404', {
            message: 'Có lỗi xảy ra khi tải hồ sơ người dùng',
            user: req.user
        });
    }
};

exports.followUser = async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'User ID is required' 
            });
        }
        if (userId === req.user.id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Không thể theo dõi chính mình' 
            });
        }
        
        const currentUser = await User.findById(req.user.id);
        const targetUser = await User.findById(userId);
        
        if (!targetUser) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy người dùng' 
            });
        }
        
        const isFollowing = currentUser.following.includes(userId);
        
        if (isFollowing) {
            currentUser.following = currentUser.following.filter(
                id => id.toString() !== userId
            );
            targetUser.followers = targetUser.followers.filter(
                id => id.toString() !== req.user.id
            );
            
            await Promise.all([currentUser.save(), targetUser.save()]);
            
            await logActivity(req.user.id, 'Hủy theo dõi người dùng', `Đã hủy theo dõi ${targetUser.username}`, true, req);
            
            return res.json({
                success: true,
                following: false,
                message: `Đã hủy theo dõi ${targetUser.name}`
            });
        } else {
            currentUser.following.push(userId);
            targetUser.followers.push(req.user.id);
            
            await Promise.all([currentUser.save(), targetUser.save()]);
            
            await logActivity(req.user.id, 'Theo dõi người dùng', `Đã theo dõi ${targetUser.username}`, true, req);
            
            return res.json({
                success: true,
                following: true,
                message: `Đã theo dõi ${targetUser.name}`
            });
        }
    } catch (error) {
        console.error('Error following/unfollowing user:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xử lý yêu cầu'
        });
    }
};

exports.savePost = async (req, res) => {
    try {
        const { postId } = req.body;
        
        if (!postId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Post ID is required' 
            });
        }
        
        const currentUser = await User.findById(req.user.id);
        const { Post } = require('../models/discussion.model');
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: 'Không tìm thấy bài viết' 
            });
        }
        
        const isSaved = currentUser.savedPosts && currentUser.savedPosts.includes(postId);
        
        if (isSaved) {
            currentUser.savedPosts = currentUser.savedPosts.filter(
                id => id.toString() !== postId
            );
            
            await currentUser.save();
            
            await logActivity(req.user.id, 'Hủy lưu bài viết', `Đã hủy lưu bài viết: ${post.title}`, true, req);
            
            return res.json({
                success: true,
                saved: false,
                message: 'Đã hủy lưu bài viết'
            });
        } else {
            if (!currentUser.savedPosts) {
                currentUser.savedPosts = [];
            }
            
            currentUser.savedPosts.push(postId);
            await currentUser.save();
            
            await logActivity(req.user.id, 'Lưu bài viết', `Đã lưu bài viết: ${post.title}`, true, req);
            
            return res.json({
                success: true,
                saved: true,
                message: 'Đã lưu bài viết thành công'
            });
        }
    } catch (error) {
        console.error('Error saving/unsaving post:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi xử lý yêu cầu'
        });
    }
};

exports.exploreUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 12;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const filter = req.query.filter || 'all';
        
        let query = {};
        if (search) {
            if (filter === 'name') {
                query.name = { $regex: search, $options: 'i' };
            } else {
                query = {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { username: { $regex: search, $options: 'i' } }
                    ]
                };
            }
        }
        query._id = { $ne: new mongoose.Types.ObjectId(req.user.id) };
        
        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);
        
        const users = await User.find(query)
            .select('name username avatar followers following')
            .skip(skip)
            .limit(limit)
            .lean();
        
        const { Post } = require('../models/discussion.model');
        const currentUser = await User.findById(req.user.id);
        const followingIds = currentUser.following.map(id => id.toString());
        
        for (let user of users) {
            user.postCount = await Post.countDocuments({ author: user._id });
            user.isFollowing = followingIds.includes(user._id.toString());
        }
        
        const pagination = {
            page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page + 1,
            prevPage: page - 1,
            pages: []
        };
        
        const delta = 2;
        const range = [];
        for (let i = Math.max(1, page - delta); i <= Math.min(totalPages, page + delta); i++) {
            range.push({
                page: i,
                isActive: i === page
            });
        }
        pagination.pages = range;
        
        res.render('pages/explore', {
            title: 'Khám phá người dùng',
            users,
            search,
            filter,
            pagination,
            user: req.user
        });
        
    } catch (error) {
        console.error('Error exploring users:', error);
        res.status(500).render('pages/404', {
            message: 'Có lỗi xảy ra khi tải danh sách người dùng',
            user: req.user
        });
    }
};