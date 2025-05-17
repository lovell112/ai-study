const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Category Schema
const CategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    postCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hashtag Schema
const HashtagSchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    postCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Reply Schema (for nested comments)
const ReplySchema = new Schema({
    content: {
        type: String,
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Comment Schema
const CommentSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    replies: [ReplySchema],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Post Schema
const PostSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    hashtags: [{
        type: Schema.Types.ObjectId,
        ref: 'Hashtag'
    }],
    likes: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [CommentSchema],
    views: {
        type: Number,
        default: 0
    },
    image: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Category = mongoose.model('Category', CategorySchema);
const Hashtag = mongoose.model('Hashtag', HashtagSchema);
const Post = mongoose.model('Post', PostSchema);

module.exports = {
    Category,
    Hashtag,
    Post
};
