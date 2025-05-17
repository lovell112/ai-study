require('dotenv').config();
const express = require("express");
const path = require("path");
const hbs = require("express-handlebars");
const cookieParser = require("cookie-parser");
const app = express();
const port = process.env.PORT || 3000;

// Config routes
const clientRoutes = require("./routes/clientViews.route");
const authRoutes = require("./routes/auth.route");
const userRoutes = require("./routes/user.route");
const aiRoutes = require("./routes/ai.route");
const suggestionRoutes = require("./routes/suggestion.route");
const calendarRoutes = require("./routes/calendar.route");
const discussionRoutes = require('./routes/discussion.route');

// Config database
const connectDB = require("./config/database.config");

// Config middleware
const { isLoggedIn } = require("./middleware/auth.middleware");

(async () => {
  try {
    await connectDB();
    startServer();
  } catch (error) {
    console.error("Kết nối cơ sở dữ liệu thất bại:", error);
    console.error("Vui lòng kiểm tra cấu hình cơ sở dữ liệu của bạn.");
    process.exit(1);
  }
})();

function startServer() {
  const hbsInstance = hbs.create({
    extname: ".hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    runtimeOptions: {
      allowProtoPropertiesByDefault: true,
      allowProtoMethodsByDefault: true
    },
    helpers: {
      add: function(a, b) {
        return a + b;
      },
      formatTimeAgo: function(timestamp) {
        if (!timestamp) return '';
        
        const now = new Date();
        const date = new Date(timestamp);
        const diff = Math.floor((now - date) / 1000); 
        
        if (diff < 60) return 'Vừa xong';
        if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
        
        return date.toLocaleDateString('vi-VN');
      },
      formatDate: function(timestamp, format) {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        
        return format.replace('DD', day)
                     .replace('MM', month)
                     .replace('YYYY', year)
                     .replace('HH', hours)
                     .replace('mm', minutes);
      },
      truncate: function(content, length) {
        if (!content) return '';
        const text = content.replace(/<[^>]*>/g, '');
        
        if (text.length <= length) return text;
        return text.substring(0, length) + '...';
      },
      ifEquals: function(arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
      },
      ifNotEquals: function(arg1, arg2, options) {
        return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
      },
      timestampToValue: function(timestamp) {
        if (!isNaN(timestamp)) {
          return timestamp;
        }
        
        try {
          const date = new Date(timestamp);
          return date.getTime();
        } catch (e) {
          return 0; 
        }
      },
      eq: function(a, b) {
        return a === b;
      },
      json: function(context) {
        return JSON.stringify(context);
      }
    }
  });

  

  app.engine("hbs", hbsInstance.engine);
  app.set("view engine", "hbs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/assets", express.static(path.join(__dirname, "assets")));
  app.use("/storage", express.static(path.join(__dirname, "storage")));
  app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
  app.use(cookieParser());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const multer = require('multer');
  const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'public/uploads/posts');
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `post-${uniqueSuffix}${ext}`);
    }
  });

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

  app.use((req, res, next) => {
    const cookies = {...req.cookies};
    if (cookies.jwt_token) {
      cookies.jwt_token = cookies.jwt_token.substring(0, 20) + '...';
    }
    next();
  });

  app.use((req, res, next) => {
    res.locals.success = [];
    res.locals.error = [];
    req.flash = () => req;
    next();
  });
  app.use((req, res, next) => {
    if (req.user && req.user.avatar) {
      if (!req.user.avatar.startsWith('http') && !req.user.avatar.startsWith('/')) {
        req.user.avatar = '/' + req.user.avatar;
      }
    }
    
    if (res.locals.user && res.locals.user.avatar) {
      if (!res.locals.user.avatar.startsWith('http') && !res.locals.user.avatar.startsWith('/')) {
        res.locals.user.avatar = '/' + res.locals.user.avatar;
      }
    }
    
    next();
  });
  app.use((req, res, next) => {
    if (req.user) {
      if (!req.user.avatar || req.user.avatar.trim() === '') {
        req.user.avatar = '/assets/images/avatars/default.png';
      } else if (!req.user.avatar.startsWith('http') && !req.user.avatar.startsWith('/')) {
        req.user.avatar = '/' + req.user.avatar;
      }
    }
    
    if (res.locals.user) {
      if (!res.locals.user.avatar || res.locals.user.avatar.trim() === '') {
        res.locals.user.avatar = '/assets/images/avatars/default.png';
      } else if (!res.locals.user.avatar.startsWith('http') && !res.locals.user.avatar.startsWith('/')) {
        res.locals.user.avatar = '/' + res.locals.user.avatar;
      }
    }
    
    next();
  });
  app.use((req, res, next) => {
    res.locals._renderWithUser = res.render;
    res.render = function(view, options) {
      options = options || {};
      if (options.user && (!options.user.avatar || typeof options.user.avatar !== 'string')) {
        options.user.avatar = '/assets/images/avatars/default.png';
      }
      if (res.locals.user && (!res.locals.user.avatar || typeof res.locals.user.avatar !== 'string')) {
        res.locals.user.avatar = '/assets/images/avatars/default.png';
      }
      res.locals._renderWithUser.call(this, view, options);
    };
    
    next();
  });
  const mongoose = require('mongoose');

  app.use(isLoggedIn); 
  app.use("/api/auth", authRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/ai/suggestions", suggestionRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/calendar", calendarRoutes);
  app.use("/discussion", discussionRoutes);
  app.use("/", clientRoutes); 

  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  });

  app.listen(port, () => {
    console.log(`Hoạt động tại http://localhost:${port}`);
  });
}
