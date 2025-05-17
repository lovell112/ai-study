const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { requireAuth, logout } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');
const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.post('/register', authController.register);

if (!authController.cleanupTokens) {
  authController.cleanupTokens = function(req, res) {
    const cookieOptions = [
      { path: '/' },
      { path: '/', sameSite: 'lax' },
      { path: '/', httpOnly: true },
      { path: '/', httpOnly: false }
    ];
    
    cookieOptions.forEach(options => {
      res.clearCookie('jwt_token', options);
      res.clearCookie('token', options);
    });
    
    return res.redirect('/login?cleaned=true');
  };
}

router.post('/login', async (req, res) => {
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
      
      if (isMatch) {
        const token = jwt.sign({
          id: user._id.toString(), 
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone || ''
        }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' });
        
        res.cookie('jwt_token', token, { 
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, 
          path: '/',
          sameSite: 'lax'
        });
        
        return res.json({
          success: true,
          message: 'Đăng nhập thành công',
          token,
          redirectTo: req.body.redirectTo || '/home'
        });
      }
    } else {
      await userController.logLoginActivity(
        null,
        false, 
        'Tên đăng nhập không tồn tại', 
        req
      );
    }
    
    return res.status(401).json({
      success: false,
      message: 'Tên đăng nhập hoặc mật khẩu không đúng'
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi đăng nhập'
    });
  }
});

router.get('/logout', logout);
router.post('/logout', logout);

router.get('/cleanup-tokens', authController.cleanupTokens);
router.get('/user', requireAuth, authController.getCurrentUser);

router.get('/auth-status', function(req, res) {
  let token;
  let tokenSource = 'none';
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    tokenSource = 'authorization_header';
  } 
  else if (req.cookies && req.cookies.jwt_token) {
    token = req.cookies.jwt_token;
    tokenSource = 'jwt_token_cookie';
  }
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
    tokenSource = 'token_cookie';
  }
  else if (req.query && req.query.token) {
    token = req.query.token;
    tokenSource = 'query_parameter';
  }
  
  let tokenStatus = 'missing';
  let tokenData = null;
  
  if (token) {
    tokenStatus = 'invalid';
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      tokenStatus = 'valid';
      tokenData = {
        id: decoded.id,
        username: decoded.username,
        name: decoded.name,
        exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'unknown',
        iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : 'unknown',
      };
    } catch (error) {
      tokenStatus = 'invalid: ' + error.message;
    }
  }
  
  return res.json({
    auth: {
      tokenStatus,
      tokenSource,
      tokenData,
      cookies: req.cookies ? Object.keys(req.cookies) : [],
      hasJwtCookie: !!req.cookies?.jwt_token,
      hasTokenCookie: !!req.cookies?.token
    }
  });
});

module.exports = router;
