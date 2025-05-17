const { Post, Category, Hashtag } = require('../models/discussion.model');
const User = require('../models/user.model');
const slugify = require('slugify');
const mongoose = require('mongoose');
const fs = require('fs');

function ensureValidAvatarPath(user) {
    if (!user) return;
    if (!user.avatar || user.avatar.trim() === '') {
        user.avatar = '/assets/images/avatars/default.png';
    } else if (!user.avatar.startsWith('http') && !user.avatar.startsWith('/')) {
        user.avatar = '/' + user.avatar;
    }
    return user;
}

exports.getDiscussionPage = async (req, res) => {
    try {
        let posts = await Post.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('author', 'name avatar username')
            .populate('category', 'name')
            .populate('hashtags', 'name')
            .populate({
                path: 'comments.author',
                select: 'name avatar username'
            })
            .populate({
                path: 'comments.replies.author',  
                select: 'name avatar username'
            });

        const categories = await Category.find({}).sort({ postCount: -1 });
        const trendingHashtags = await Hashtag.find({}).sort({ postCount: -1 }).limit(10);
        const trendingTopics = await Post.find({})
            .sort({ views: -1, likes: -1 })
            .limit(3)
            .select('title views');
        let suggestedUsers = await User.find({})
            .limit(3)
            .select('name avatar department');
        posts = posts.map(post => {
            if (post.author) {
                ensureValidAvatarPath(post.author);
            }
            if (post.comments && post.comments.length > 0) {
                post.comments.forEach(comment => {
                    if (comment.author) {
                        ensureValidAvatarPath(comment.author);
                    }
                    
                    if (comment.replies && comment.replies.length > 0) {
                        comment.replies.forEach(reply => {
                            if (reply.author) {
                                ensureValidAvatarPath(reply.author);
                            }
                        });
                    }
                });
            }
            
            return post;
        });
        suggestedUsers = suggestedUsers.map(user => ensureValidAvatarPath(user));
        res.render('pages/discussion', {
            posts,
            categories,
            trendingHashtags,
            trendingTopics,
            suggestedUsers,
            user: res.locals.user
        });
    } catch (error) {
        console.error('Error loading discussion page:', error);
        res.status(500).send('Internal Server Error');
    }
};
exports.createPost = async (req, res) => {
    try {
        const { title, content, categoryId } = req.body;
        let { hashtags } = req.body;
        const image = req.file ? req.file.filename : null;
        if (!title || !content || !categoryId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Title, content, and category are required' 
            });
        }
        if (!req.user || (!req.user.id && !req.user._id)) {
            if (res.locals.user && (res.locals.user.id || res.locals.user._id)) {
                req.user = res.locals.user;
            } else {
                return res.status(401).json({
                    success: false,
                    message: 'User authentication required'
                });
            }
        }
        const userId = req.user.id || req.user._id;
        if (req.file) {
        }
        const hashtagIds = [];
        
        if (hashtags) {
            if (!Array.isArray(hashtags)) {
                hashtags = [hashtags];
            }
            const processedTags = [];
            
            for (let tag of hashtags) {
                if (!tag || processedTags.includes(tag)) continue;
                tag = tag.trim().toLowerCase();
                if (tag.startsWith('#')) tag = tag.substring(1);
                tag = tag.trim();
                if (!tag) continue;
                processedTags.push(tag);
                let hashtag = await Hashtag.findOne({ name: tag });
                if (!hashtag) {
                    hashtag = await Hashtag.create({ name: tag });
                } else {
                    hashtag.postCount += 1;
                    await hashtag.save();
                }
                hashtagIds.push(hashtag._id);
            }
        }
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(404).json({ 
                success: false, 
                message: 'Category not found' 
            });
        }
        category.postCount += 1;
        await category.save();
        const post = await Post.create({
            title,
            content,
            author: userId,
            category: categoryId,
            hashtags: hashtagIds,
            image
        });
        await post.populate('author', 'name avatar');
        await post.populate('category', 'name');
        await post.populate('hashtags', 'name');

        res.status(201).json({
            success: true,
            post
        });
    } catch (error) {
        console.error('Error creating post:', error);
        if (req.file) {
            try {
                const filePath = req.file.path;
                fs.unlinkSync(filePath);
            } catch (cleanupError) {
                console.error('Error cleaning up uploaded file:', cleanupError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};
exports.getCategories = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.status(200).json({ 
            success: true, 
            categories 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
exports.getHashtags = async (req, res) => {
    try {
        const query = req.query.search || '';
        const cleanQuery = query.startsWith('#') ? query.substring(1).trim() : query.trim();
        const hashtags = await Hashtag.find({ 
            name: { $regex: cleanQuery, $options: 'i' } 
        })
        .sort({ postCount: -1 })
        .limit(10);
        
        res.status(200).json({ 
            success: true, 
            hashtags 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
exports.addComment = async (req, res) => {
    try {
        const { postId, content } = req.body;
        
        if (!content) {
            return res.status(400).json({ 
                success: false, 
                message: 'Comment content is required' 
            });
        }

        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        post.comments.push({
            content,
            author: req.user._id
        });
        await post.save();
        const newComment = post.comments[post.comments.length - 1];
        await Post.populate(post, {
            path: 'comments.author',
            select: 'name avatar username', 
            model: 'User'
        });
        const populatedComment = post.comments[post.comments.length - 1];
        if (populatedComment && populatedComment.author) {
            ensureValidAvatarPath(populatedComment.author);
        }

        res.status(201).json({
            success: true,
            comment: populatedComment
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
exports.likePost = async (req, res) => {
    try {
        const { postId } = req.body;
        
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        const alreadyLiked = post.likes.includes(req.user._id);
        if (alreadyLiked) {
            post.likes = post.likes.filter(
                userId => userId.toString() !== req.user._id.toString()
            );
        } else {
            post.likes.push(req.user._id);
        }
        await post.save();

        res.status(200).json({
            success: true,
            likes: post.likes.length,
            liked: !alreadyLiked
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

exports.getPostDetail = async (req, res) => {
    try {
        const postId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(404).render('pages/404', { 
                message: 'Bài viết không tồn tại'
            });
        }
        const post = await Post.findByIdAndUpdate(
            postId, 
            { $inc: { views: 1 } },
            { new: true }
        )
        .populate('author', 'name avatar username')  
        .populate('category')
        .populate('hashtags')
        .populate({
            path: 'comments.author',
            select: 'name avatar username',  
            model: 'User'
        })
        .populate({
            path: 'comments.replies.author',
            select: 'name avatar username',  
            model: 'User'
        });
        
        if (!post) {
            return res.status(404).render('pages/404', { 
                message: 'Bài viết không tồn tại hoặc đã bị xóa'
            });
        }
        if (post.author) {
            ensureValidAvatarPath(post.author);
        }
        if (post.comments && post.comments.length > 0) {
            post.comments.forEach(comment => {
                if (comment.author) {
                    ensureValidAvatarPath(comment.author);
                }
                if (comment.replies && comment.replies.length > 0) {
                    comment.replies.forEach(reply => {
                        if (reply.author) {
                            ensureValidAvatarPath(reply.author);
                        }
                    });
                }
            });
        }
        let isLiked = false;
        if (req.user) {
            isLiked = post.likes.includes(req.user.id);
        }
        post.comments.forEach(comment => {
            comment.isLiked = req.user ? comment.likes.includes(req.user.id) : false;
        });
        let isFollowing = false;
        if (req.user && post.author) {
            const author = await User.findById(post.author._id);
            isFollowing = author.followers && author.followers.includes(req.user.id);
        }
        const relatedPosts = await Post.find({
            _id: { $ne: post._id },
            $or: [
                { category: post.category._id },
                { hashtags: { $in: post.hashtags.map(tag => tag._id) } }
            ]
        })
        .limit(5)
        .select('title createdAt comments')
        .sort({ createdAt: -1 });
        const popularTags = await Hashtag.find()
            .sort({ postCount: -1 })
            .limit(10);
        const currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        res.render('pages/post', {
            post,
            isLiked,
            isFollowing,
            relatedPosts,
            popularTags,
            currentUrl,
            user: res.locals.user
        });
    } catch (error) {
        console.error('Error loading post detail:', error);
        res.status(500).render('pages/error', { 
            message: 'Đã xảy ra lỗi khi tải bài viết',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};
exports.replyToComment = async (req, res) => {
    try {
        const { commentId, content } = req.body;
        
        if (!content) {
            return res.status(400).json({ 
                success: false, 
                message: 'Reply content is required' 
            });
        }
        const post = await Post.findOne({
            'comments._id': commentId
        });
        
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }
        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }
        if (!comment.replies) {
            comment.replies = [];
        }
        
        comment.replies.push({
            content,
            author: req.user._id
        });
        
        await post.save();
        await Post.populate(post, {
            path: 'comments.replies.author',
            select: 'name avatar username',  
            model: 'User'
        });
        const newReply = comment.replies[comment.replies.length - 1];
        if (newReply && newReply.author) {
            ensureValidAvatarPath(newReply.author);
        }
        
        res.status(201).json({
            success: true,
            reply: newReply
        });
    } catch (error) {
        console.error('Error replying to comment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
exports.likeComment = async (req, res) => {
    try {
        const { commentId } = req.body;
        const post = await Post.findOne({
            'comments._id': commentId
        });
        
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }
        const comment = post.comments.id(commentId);
        if (!comment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Comment not found' 
            });
        }
        const alreadyLiked = comment.likes.includes(req.user._id);
        if (alreadyLiked) {
            comment.likes = comment.likes.filter(
                userId => userId.toString() !== req.user._id.toString()
            );
        } else {
            comment.likes.push(req.user._id);
        }
        
        await post.save();
        
        res.status(200).json({
            success: true,
            likes: comment.likes.length,
            liked: !alreadyLiked
        });
    } catch (error) {
        console.error('Error liking comment:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
exports.reportPost = async (req, res) => {
    try {
        const { postId, reason, details } = req.body;
        if (!postId || !reason) {
            return res.status(400).json({ 
                success: false, 
                message: 'Post ID and reason are required' 
            });
        }
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        const report = {
            post: postId,
            reporter: req.user._id,
            reason,
            details: details || '',
            createdAt: new Date()
        };
        res.status(200).json({
            success: true,
            message: 'Post reported successfully'
        });
    } catch (error) {
        console.error('Error reporting post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
exports.deletePost = async (req, res) => {
    try {
        const postId = req.params.id;
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        if (post.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'You are not authorized to delete this post' 
            });
        }
        await Category.findByIdAndUpdate(
            post.category,
            { $inc: { postCount: -1 } }
        );
        for (const tagId of post.hashtags) {
            await Hashtag.findByIdAndUpdate(
                tagId,
                { $inc: { postCount: -1 } }
            );
        }
        await Post.findByIdAndDelete(postId);
        
        res.status(200).json({
            success: true,
            message: 'Post deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
exports.editPost = async (req, res) => {
    try {
        const postId = req.params.id;
        const { title, content, categoryId } = req.body;
        let { hashtags } = req.body;
        const image = req.file ? req.file.filename : undefined;
        const post = await Post.findById(postId);
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                message: 'Post not found' 
            });
        }
        if (post.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'You are not authorized to edit this post' 
            });
        }
        if (hashtags) {
            if (!Array.isArray(hashtags)) {
                hashtags = [hashtags];
            }
            for (const tagId of post.hashtags) {
                await Hashtag.findByIdAndUpdate(
                    tagId,
                    { $inc: { postCount: -1 } }
                );
            }
            const processedTags = [];
            const hashtagIds = [];
            
            for (let tag of hashtags) {
                if (!tag || processedTags.includes(tag)) continue;
                tag = tag.trim().toLowerCase();
                if (tag.startsWith('#')) tag = tag.substring(1);
                tag = tag.trim();
                if (!tag) continue;
                processedTags.push(tag);
                let hashtag = await Hashtag.findOne({ name: tag });
                if (!hashtag) {
                    hashtag = await Hashtag.create({ name: tag });
                } else {
                    hashtag.postCount += 1;
                    await hashtag.save();
                }
                hashtagIds.push(hashtag._id);
            }
            
            post.hashtags = hashtagIds;
        }
        if (categoryId && post.category.toString() !== categoryId) {
            await Category.findByIdAndUpdate(
                post.category,
                { $inc: { postCount: -1 } }
            );
            await Category.findByIdAndUpdate(
                categoryId,
                { $inc: { postCount: 1 } }
            );
            
            post.category = categoryId;
        }
        post.title = title || post.title;
        post.content = content || post.content;
        if (image) post.image = image;
        post.updatedAt = new Date();
        
        await post.save();
        
        res.status(200).json({
            success: true,
            post
        });
    } catch (error) {
        console.error('Error updating post:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
exports.search = async (req, res) => {
    try {
        const { q, type } = req.query;
        
        if (!q) {
            return res.render('pages/search-results', {
                results: [],
                query: '',
                type: type || 'posts',
                count: 0
            });
        }
        
        let results = [];
        let count = 0;
        
        switch(type) {
            case 'users':
                results = await User.find({
                    $or: [
                        { name: { $regex: q, $options: 'i' } },
                        { email: { $regex: q, $options: 'i' } }
                    ]
                })
                .select('name avatar username')
                .limit(20);
                count = await User.countDocuments({
                    $or: [
                        { name: { $regex: q, $options: 'i' } },
                        { email: { $regex: q, $options: 'i' } }
                    ]
                });
                break;
                
            case 'tags':
                results = await Hashtag.find({
                    name: { $regex: q, $options: 'i' }
                })
                .sort({ postCount: -1 })
                .limit(20);
                count = await Hashtag.countDocuments({
                    name: { $regex: q, $options: 'i' }
                });
                break;
                
            default:
                results = await Post.find({
                    $or: [
                        { title: { $regex: q, $options: 'i' } },
                        { content: { $regex: q, $options: 'i' } }
                    ]
                })
                .populate('author', 'name avatar')
                .populate('category', 'name')
                .populate('hashtags', 'name')
                .sort({ createdAt: -1 })
                .limit(20);
                count = await Post.countDocuments({
                    $or: [
                        { title: { $regex: q, $options: 'i' } },
                        { content: { $regex: q, $options: 'i' } }
                    ]
                });
        }
        
        res.render('pages/search-results', {
            results,
            query: q,
            type: type || 'posts',
            count,
            user: res.locals.user
        });
    } catch (error) {
        console.error('Error searching:', error);
        res.status(500).render('pages/error', { 
            message: 'Đã xảy ra lỗi khi tìm kiếm',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};
exports.getCategoryPage = async (req, res) => {
    try {
        const categorySlug = req.params.slug;
        const category = await Category.findOne({ slug: categorySlug });
        if (!category) {
            return res.status(404).render('pages/404', { 
                message: 'Danh mục không tồn tại'
            });
        }
        const posts = await Post.find({ category: category._id })
            .sort({ createdAt: -1 })
            .populate('author', 'name avatar')
            .populate('category', 'name')
            .populate('hashtags', 'name')
            .limit(20);
        const categories = await Category.find().sort({ postCount: -1 });
        const trendingHashtags = await Hashtag.find().sort({ postCount: -1 }).limit(10);
        
        res.render('pages/category', {
            category,
            posts,
            categories,
            trendingHashtags
        });
    } catch (error) {
        console.error('Error loading category page:', error);
        res.status(500).render('pages/error', { 
            message: 'Đã xảy ra lỗi khi tải trang danh mục',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};
exports.getTagPage = async (req, res) => {
    try {
        const tagName = req.params.name;
        const hashtag = await Hashtag.findOne({ name: tagName });
        if (!hashtag) {
            return res.status(404).render('pages/404', { 
                message: 'Thẻ không tồn tại'
            });
        }
        const posts = await Post.find({ hashtags: hashtag._id })
            .sort({ createdAt: -1 })
            .populate('author', 'name avatar')
            .populate('category', 'name slug')
            .populate('hashtags', 'name')
            .limit(20);
        const categories = await Category.find().sort({ postCount: -1 });
        const trendingHashtags = await Hashtag.find().sort({ postCount: -1 }).limit(10);
        
        res.render('pages/tag', {
            hashtag,
            posts,
            categories,
            trendingHashtags
        });
    } catch (error) {
        console.error('Error loading tag page:', error);
        res.status(500).render('pages/error', { 
            message: 'Đã xảy ra lỗi khi tải trang thẻ',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};
exports.getEditPostPage = async (req, res) => {
    try {
        const postId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(404).render('pages/404', { 
                message: 'Bài viết không tồn tại',
                user: res.locals.user
            });
        }
        const post = await Post.findById(postId)
            .populate('author', 'name avatar _id')
            .populate('category', 'name _id')
            .populate('hashtags', 'name');
        
        if (!post) {
            return res.status(404).render('pages/404', { 
                message: 'Bài viết không tồn tại hoặc đã bị xóa',
                user: res.locals.user
            });
        }
        const userId = (req.user && (req.user.id || req.user._id)) || 
                    (res.locals.user && (res.locals.user.id || res.locals.user._id));
        const isAuthor = userId && post.author._id.toString() === userId.toString();
        const categories = await Category.find().sort({ name: 1 });
        res.render('pages/edit', {
            post,
            categories,
            isAuthor,
            user: res.locals.user
        });
    } catch (error) {
        console.error('Error loading edit post page:', error);
        res.status(500).render('pages/error', { 
            message: 'Đã xảy ra lỗi khi tải trang chỉnh sửa bài viết',
            error: process.env.NODE_ENV === 'development' ? error : {},
            user: res.locals.user
        });
    }
};