const express = require('express');
const router = express.Router();
const path = require('path'); 
const { protect, allowPublic, requireAuth } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');
function ensureValidUser(req, res) {
  if (!res.locals.user && req.user) {
    res.locals.user = req.user;
  }
  
  if (res.locals.user && (!res.locals.user.avatar || !res.locals.user.avatar.startsWith('/'))) {
    if (!res.locals.user.avatar || res.locals.user.avatar.trim() === '') {
      res.locals.user.avatar = '/assets/images/avatars/default.png';
    } else if (!res.locals.user.avatar.startsWith('/') && !res.locals.user.avatar.startsWith('http')) {
      res.locals.user.avatar = '/' + res.locals.user.avatar;
    }
  }
  
  return res.locals.user;
}

router.use(function(req, res, next) {
  if (req.query && req.query.token) {
    const token = req.query.token;
    res.cookie('jwt_token', token, { 
      httpOnly: false,
      maxAge: 24 * 60 * 60 * 1000, 
      path: '/',
      sameSite: 'lax'
    });
    
    try {
      const currentUrl = req.originalUrl;
      const urlObj = new URL(currentUrl, `http://${req.headers.host}`);
      urlObj.searchParams.delete('token');
      const cleanUrl = urlObj.pathname + urlObj.search;
      return res.redirect(cleanUrl);
    } catch (e) {
      console.error('Error cleaning URL:', e);
    }
  }
  next();
});
router.get("/", allowPublic, (req, res) => {
  res.render("pages/landing", {
    layout: "landing",
  });
});

router.get("/login", allowPublic, (req, res) => {
  if (req.query.loop_detected === 'true' || req.query.loop_fixed === 'true') {
    return res.render("pages/login", {
      layout: "auth",
      title: "Đăng nhập",
      redirectTo: '/home',
      loopDetected: req.query.loop_detected === 'true',
      loopFixed: req.query.loop_fixed === 'true',
      message: req.query.loop_fixed === 'true' ? 
        'Đã phát hiện vấn đề về đăng nhập. Vui lòng đăng nhập lại.' :
        null
    });
  }
  
  if (res.locals.isLoggedIn) {
    return res.redirect('/home');
  }
  
  const redirectTo = req.query.noredirect === 'true' ? 
    '/home' : 
    (req.query.redirect || '/home');
  
  res.render("pages/login", {
    layout: "auth",
    title: "Đăng nhập",
    redirectTo: redirectTo
  });
});

router.get("/register", allowPublic, (req, res) => {
  if (res.locals.isLoggedIn) {
    return res.redirect('/home');
  }
  
  res.render("pages/register", {
    layout: "auth",
    title: "Đăng ký"
  });
});

router.get("/contact", allowPublic, (req, res) => {
  res.render("pages/contact");
});

router.get("/home", protect, (req, res) => {
  res.render("pages/home", {
    user: ensureValidUser(req, res)
  });
});

router.get('/settings', requireAuth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      console.error("User data not available in request");
      return res.status(401).redirect('/login?redirect=/settings');
    }
    
    const activityHistory = await userController.getUserActivity(req.user.id);
    
    res.render('pages/settings', { 
      user: req.user, 
      activityHistory: activityHistory 
    });
  } catch (error) {
    console.error('Error rendering settings page:', error);
    
    res.status(500).render('pages/404', { 
      message: 'Đã xảy ra lỗi khi tải trang cài đặt',
      error: process.env.NODE_ENV === 'development' ? error : {} 
    });
  }
});

router.get("/calendar", protect, (req, res) => {
  res.render("pages/calendar", {
    user: ensureValidUser(req, res)
  });
});

router.get("/ai-chat", protect, (req, res) => {
  res.render("pages/ai-chat", {
    user: ensureValidUser(req, res)
  });
});

router.get("/histories", protect, (req, res) => {
  res.render("pages/histories", {
    user: ensureValidUser(req, res)
  });
});

router.get("/history/:id", protect, (req, res) => {
  res.render("pages/history", { 
    user: ensureValidUser(req, res)
  });
});

router.get("/discussion", protect, (req, res) => {
  if (req.user && req.user.avatar) {
    if (!req.user.avatar.startsWith('/') && !req.user.avatar.startsWith('http')) {
      req.user.avatar = '/' + req.user.avatar;
    }
  } else if (req.user) {
    req.user.avatar = '/assets/images/avatars/default.png';
  }
  const discussionController = require('../controllers/discussion.controller');
  return discussionController.getDiscussionPage(req, res);
});

router.get("/post/:id", protect, (req, res) => {
  const discussionController = require('../controllers/discussion.controller');
  return discussionController.getPostDetail(req, res);
});

router.get("/search-results", protect, (req, res) => {
  const discussionController = require('../controllers/discussion.controller');
  return discussionController.search(req, res);
});
router.get("/profile/:username", protect, async (req, res) => {
  try {
    const username = req.params.username;
    const userController = require('../controllers/user.controller');
    return userController.getUserProfile(req, res, username);
  } catch (error) {
    console.error("Error loading profile page:", error);
    return res.status(500).render("pages/404", {
      message: "Có lỗi xảy ra khi tải trang hồ sơ",
      user: ensureValidUser(req, res)
    });
  }
});

router.get("/users/explore", protect, async (req, res) => {
  try {
    const userController = require('../controllers/user.controller');
    return userController.exploreUsers(req, res);
  } catch (error) {
    console.error("Error loading users page:", error);
    return res.status(500).render("pages/404", {
      message: "Có lỗi xảy ra khi tải danh sách người dùng",
      user: ensureValidUser(req, res)
    });
  }
});
router.get("/discussion/edit/:id", protect, (req, res) => {
  try {
    const discussionController = require('../controllers/discussion.controller');
    return discussionController.getEditPostPage(req, res);
  } catch (error) {
    console.error("Error loading edit post page:", error);
    return res.status(500).render("pages/404", {
      message: "Có lỗi xảy ra khi tải trang chỉnh sửa bài viết",
      user: ensureValidUser(req, res)
    });
  }
});
router.get("/404", allowPublic, (req, res) => {
  res.status(404).render("pages/404", {
    user: res.locals.user
  });
});

router.use((req, res, next) => {
  res.status(404).render("pages/404", {
    user: res.locals.user
  });
});

module.exports = router;
