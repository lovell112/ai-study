const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const userController = require('../controllers/user.controller');
const bcrypt = require('bcrypt');

exports.requireAuth = async (req, res, next) => {
    try {
        let token = req.cookies.jwt_token;
        
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        if (!token && req.cookies.token) {
            token = req.cookies.token;
        }
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Authorization required'
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        if (!decoded.id) {
            return res.status(401).json({
                success: false,
                message: 'Invalid authentication token'
            });
        }
        
        req.user = decoded;

        if (req.user) {
            const user = await User.findById(req.user.id).select('-password');
            if (user && user.avatar) {
                req.user.avatar = user.avatar;
            }
        }

        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({
            success: false,
            message: 'Session expired, please login again'
        });
    }
};

exports.isLoggedIn = async (req, res, next) => {
  try {
    res.locals.isLoggedIn = false;
    res.locals.user = null;
    const token = extractTokenFromRequest(req);

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findById(decoded.id).select('-password');
        if (user) {
          const fullUser = { 
            ...decoded, 
            avatar: user.avatar || '/assets/images/avatars/default.png' 
          };
          const normalizedUser = ensureValidAvatarPath(fullUser);
          
          res.locals.isLoggedIn = true;
          res.locals.user = normalizedUser;
          req.user = normalizedUser; 
        }
      } catch (err) {
        console.error('JWT verification error:', err.message);
        clearAllTokens(res);
      }
    }
    
    next();
  } catch (error) {
    console.error('isLoggedIn error:', error);
    next();
  }
};

function extractTokenFromRequest(req) {
  let token;
  
  if (req.query && req.query.token) {
    token = req.query.token;
    return token;
  }
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
    return token;
  }
  
  if (req.cookies && req.cookies.jwt_token) {
    token = req.cookies.jwt_token;
    return token;
  }
  
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
    return token;
  }
  
  return null;
}

function clearAllTokens(res) {
  const cookieOptions = [
    { path: '/' },
    { path: '/', sameSite: 'lax' },
    { path: '/', sameSite: 'strict' },
    { path: '/', domain: '' },
    { path: '/', secure: true },
    { path: '/', httpOnly: true },
    { path: '/', httpOnly: false }
  ];
  
  cookieOptions.forEach(options => {
    res.clearCookie('jwt_token', options);
    res.clearCookie('token', options);
  });
}

function ensureValidAvatarPath(user) {
    if (!user) return user;
    
    const newUser = {...user}; 
    if (!newUser.avatar || typeof newUser.avatar !== 'string' || newUser.avatar === 'undefined' || newUser.avatar.trim() === '') {
        newUser.avatar = '/assets/images/avatars/default.png';
    } else if (!newUser.avatar.startsWith('http') && !newUser.avatar.startsWith('/')) {
        newUser.avatar = '/' + newUser.avatar;
    }
    
    return newUser;
}

exports.allowPublic = (req, res, next) => {
  next();
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
        
        const token = jwt.sign({
            id: user._id,
            name: user.name,
            username: user.username,
            email: user.email,
            phone: user.phone
        }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1d' });
        
        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000 
        });
        
        return res.json({
            success: true,
            message: 'Đăng nhập thành công',
            token
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
    clearAllTokens(res);
    return res.redirect('/login');
};

exports.protect = async (req, res, next) => {
  try {
    let token = req.cookies.jwt_token;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    if (!token && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authorization required'
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token'
      });
    }
    
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or has been deleted'
      });
    }
    
    const userToAttach = {
      ...decoded,
      _id: decoded.id 
    };
    if (user) {
      userToAttach.avatar = user.avatar || '/assets/images/avatars/default.png';
      if (userToAttach.avatar && !userToAttach.avatar.startsWith('/') && !userToAttach.avatar.startsWith('http')) {
        userToAttach.avatar = '/' + userToAttach.avatar;
      }
    }
    req.user = userToAttach;
    res.locals.user = userToAttach; 
    
    next();
  } catch (error) {
    console.error('Protect middleware error:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Session expired, please login again'
    });
  }
};
