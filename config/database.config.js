const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/aistudy';
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000, 
    };
    
    await mongoose.connect(mongoURI, options);
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
    mongoose.connection.on('error', err => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.info('MongoDB reconnected successfully');
    });
    
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
