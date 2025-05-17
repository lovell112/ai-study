const express = require('express');
const router = express.Router();
const discussionController = require('../controllers/discussion.controller');
const { protect, requireAuth } = require('../middleware/auth.middleware');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const uploadDir = path.join(process.cwd(), 'public/uploads/posts');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedFilename);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 
    }
});

router.get('/', discussionController.getDiscussionPage);
router.post('/create-post', protect, upload.single('image'), discussionController.createPost);
router.get('/posts/:id', discussionController.getPostDetail);
router.put('/posts/:id', protect, upload.single('image'), discussionController.editPost);
router.delete('/posts/:id', protect, discussionController.deletePost);
router.post('/add-comment', protect, discussionController.addComment);
router.post('/reply-comment', protect, discussionController.replyToComment);
router.post('/like-comment', protect, discussionController.likeComment);
router.post('/like-post', protect, discussionController.likePost);
router.post('/report', protect, discussionController.reportPost);
router.get('/categories', discussionController.getCategories);
router.get('/category/:slug', discussionController.getCategoryPage);
router.get('/hashtags', discussionController.getHashtags);
router.get('/tag/:name', discussionController.getTagPage);

module.exports = router;
