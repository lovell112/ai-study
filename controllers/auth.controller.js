const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const userController = require('./user.controller');

exports.register = async (req, res) => {
    try {
        const { name, username, email, phone, password } = req.body;
        const userExistsEmail = await User.findOne({ email });
        if (userExistsEmail) {
            return res.status(400).json({
                success: false,
                message: 'Email đã được sử dụng'
            });
        }
        
        const userExistsUsername = await User.findOne({ username });
        if (userExistsUsername) {
            return res.status(400).json({
                success: false,
                message: 'Tên đăng nhập đã được sử dụng'
            });
        }
        
        if (!username || username.length < 6 || /[^a-zA-Z0-9_]/.test(username)) {
            return res.status(400).json({
                success: false,
                message: 'Username phải có ít nhất 6 ký tự và không chứa ký tự đặc biệt'
            });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`;
        
        const user = new User({
            name,
            username,
            email,
            phone,
            password: hashedPassword,
            avatar: avatarUrl
        });
        
        await user.save();
        const token = generateToken(user);
        res.cookie('jwt_token', token, { 
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 
        });
        return res.json({
            success: true,
            message: 'Đăng ký tài khoản thành công! Chào mừng bạn đến với EduAI.',
            token
        });
    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi đăng ký. Vui lòng thử lại sau.'
        });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ username });
        let isMatch = false;
        
        if (user) {
            isMatch = await bcrypt.compare(password, user.password);
            
            await userController.logLoginActivity(
                user._id, 
                isMatch, 
                isMatch ? null : 'Sai mật khẩu', 
                req
            );
        } else {
            await userController.logLoginActivity(
                null,
                false, 
                'Tên đăng nhập không tồn tại', 
                req
            );
        }
        
        if (!user || !isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Tên đăng nhập hoặc mật khẩu không đúng'
            });
        }
        
        const token = generateToken(user);
        res.cookie('jwt_token', token, { 
            httpOnly: false,
            maxAge: 24 * 60 * 60 * 1000,
            sameSite: 'lax'
        });
        res.cookie('token', token, { 
            httpOnly: false,
            maxAge: 24 * 60 * 60 * 1000, 
            path: '/',
            sameSite: 'lax'
        });
        
        const debug = {
            login_time: new Date().toISOString(),
            username: user.username,
            token_length: token.length,
            cookies_set: ['jwt_token', 'token']
        };
        return res.json({
            success: true,
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                phone: user.phone
            },
            debug
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Đã xảy ra lỗi khi đăng nhập'
        });
    }
};

exports.logout = (req, res) => {
  const cookieOptions = [
    { path: '/', sameSite: 'lax', httpOnly: false },
    { path: '/', httpOnly: true },
    { path: '/', secure: false },
    { path: '/' }
  ];
  
  cookieOptions.forEach(options => {
    res.clearCookie('jwt_token', options);
    res.clearCookie('token', options);
  });
  return res.json({
    success: true,
    message: 'Đăng xuất thành công. Hẹn gặp lại!'
  });
};
exports.cleanupTokens = (req, res) => {
  const cookieOptions = [
    { path: '/', sameSite: 'lax', httpOnly: false },
    { path: '/', httpOnly: true },
    { path: '/', secure: false },
    { path: '/' }
  ];
  
  cookieOptions.forEach(options => {
    res.clearCookie('jwt_token', options);
    res.clearCookie('token', options);
  });
  return res.redirect('/login?cleaned=true');
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Có lỗi xảy ra khi lấy thông tin người dùng' });
  }
};
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      phone: user.phone
    }, 
    process.env.JWT_SECRET || 'your-secret-key', 
    { expiresIn: '1d' }
  );
};
