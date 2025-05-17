const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const slugify = require('slugify');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aistudy', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Import the Category model
const { Category } = require('../models/discussion.model');

// Define categories to add
const categories = [
  { name: 'Học tập', description: 'Thảo luận về các vấn đề học tập' },
  { name: 'Công nghệ', description: 'Chia sẻ tin tức, kiến thức về công nghệ' },
  { name: 'Trí tuệ nhân tạo', description: 'Thảo luận về AI và ứng dụng' },
  { name: 'Lập trình', description: 'Trao đổi kinh nghiệm, code và tips lập trình' },
  { name: 'Sự kiện', description: 'Thông tin về các sự kiện, hội thảo, workshop' },
  { name: 'Sách và tài liệu', description: 'Giới thiệu và đánh giá sách, tài liệu học tập' },
  { name: 'Nhóm học tập', description: 'Tìm kiếm và tổ chức nhóm học tập' },
  { name: 'Hỏi đáp', description: 'Đặt câu hỏi và nhận câu trả lời từ cộng đồng' },
];

// Function to add categories
async function addCategories() {
  try {
    // Clear existing categories (optional, remove this if you want to keep existing categories)
    await Category.deleteMany({});
    console.log('Existing categories cleared');

    // Add slugs to categories
    const categoriesWithSlugs = categories.map(category => ({
      ...category,
      slug: slugify(category.name, { lower: true, strict: true })
    }));

    // Insert categories
    const result = await Category.insertMany(categoriesWithSlugs);
    console.log(`${result.length} categories added successfully.`);
    
    // Display added categories
    console.log('Added categories:');
    result.forEach(cat => {
      console.log(`- ${cat.name} (${cat.slug})`);
    });
    
    mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error adding categories:', error);
    mongoose.disconnect();
    process.exit(1);
  }
}

// Run the function
addCategories();

// Usage instructions:
// 1. Make sure MongoDB is running
// 2. Run this script with Node.js:
//    node scripts/add-categories.js
