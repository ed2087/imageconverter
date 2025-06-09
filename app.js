const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

// Heroku optimizations
// if (process.env.NODE_ENV === 'production') {
//     try {
//         const HerokuConfig = require('./config/heroku');
//         HerokuConfig.initialize();
//     } catch (error) {
//         console.warn('Heroku config not found, using default settings');
//     }
// }

// Import routes
const uploadRoutes = require('./routes/upload');      // Capital R
const processRoutes = require('./routes/process');    // Capital R  
const downloadRoutes = require('./routes/download');  // Capital R
const errorHandler = require('./middleware/errorHandler'); // Capital M

// Also fix this line:
//const HerokuConfig = require('./config/heroku');      // Capital C

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Heroku
app.set('trust proxy', 1);

// Security and performance middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

app.use(compression({
    level: 6,
    threshold: 1024,
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://imageconverter13-0cd3f080b99b.herokuapp.com'] // Your actual Heroku URL
        : true,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 500,
    message: {
        error: 'Too many requests',
        message: 'Too many requests from this IP, please try again later.',
        retryAfter: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        return req.path === '/health' || 
               req.path.includes('/api/process/status/') ||
               req.path.includes('/api/process/system/status');
    }
});

const statusLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 60 : 120,
    message: {
        error: 'Status check rate limit exceeded',
        message: 'Too many status checks, please reduce polling frequency.',
        retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const processLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 10 : 50,
    message: {
        error: 'Processing limit exceeded',
        message: 'Too many processing requests, please try again later.',
        retryAfter: 60 * 60
    },
    standardHeaders: true,
    legacyHeaders: false,
});

if (process.env.NODE_ENV === 'production') {
    app.use(limiter);
}

// Body parsing
app.use(express.json({ 
    limit: process.env.NODE_ENV === 'production' ? '10mb' : '50mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: process.env.NODE_ENV === 'production' ? '10mb' : '50mb'
}));

// Static files
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        if (/\.(jpg|jpeg|png|gif|ico|svg|webp)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=604800');
        }
    }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('Created temp directory');
}

// Routes
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'Image Converter',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        maxFileSize: process.env.MAX_FILE_SIZE || '10485760',
        maxFiles: process.env.MAX_FILES || '100'
    });
});

// API routes
app.use('/api/upload', uploadRoutes);
app.use('/api/process/status', statusLimiter);
app.use('/api/process/batch', processLimiter);
app.use('/api/process', processRoutes);
app.use('/api/download', downloadRoutes);

// Health check
app.get('/health', (req, res) => {
    const usage = process.memoryUsage();
    const uptime = process.uptime();
    
    let tempDirStatus = 'OK';
    try {
        fs.accessSync(tempDir, fs.constants.W_OK);
    } catch (error) {
        tempDirStatus = 'ERROR';
    }
    
    let diskSpace = 'Unknown';
    try {
        const stats = fs.statSync(tempDir);
        diskSpace = 'Available';
    } catch (error) {
        diskSpace = 'Error';
    }
    
    const healthStatus = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: Math.round(uptime),
        uptimeFormatted: formatUptime(uptime),
        memory: {
            used: Math.round(usage.heapUsed / 1024 / 1024),
            total: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024)
        },
        system: {
            tempDir: tempDirStatus,
            diskSpace: diskSpace,
            nodeVersion: process.version,
            platform: process.platform
        },
        environment: process.env.NODE_ENV || 'development',
        rateLimiting: {
            generalLimiterActive: process.env.NODE_ENV === 'production',
            statusLimiterActive: true,
            processLimiterActive: true
        }
    };
    
    res.status(200).json(healthStatus);
});

// Development endpoints
if (process.env.NODE_ENV !== 'production') {
    app.get('/system-info', (req, res) => {
        res.json({
            memory: process.memoryUsage(),
            env: {
                NODE_ENV: process.env.NODE_ENV,
                PORT: process.env.PORT,
                MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
                MAX_FILES: process.env.MAX_FILES
            },
            versions: process.versions,
            uptime: process.uptime(),
            rateLimiting: {
                generalLimiterActive: false,
                statusLimiterActive: true,
                processLimiterActive: true
            }
        });
    });
    
    app.get('/debug/rate-limits', (req, res) => {
        res.json({
            message: 'Rate limiting debug info',
            environment: process.env.NODE_ENV || 'development',
            limits: {
                general: {
                    active: process.env.NODE_ENV === 'production',
                    windowMs: 15 * 60 * 1000,
                    max: process.env.NODE_ENV === 'production' ? 100 : 500
                },
                status: {
                    active: true,
                    windowMs: 60 * 1000,
                    max: process.env.NODE_ENV === 'production' ? 60 : 120
                },
                process: {
                    active: true,
                    windowMs: 60 * 60 * 1000,
                    max: process.env.NODE_ENV === 'production' ? 10 : 50
                }
            }
        });
    });
}

// Robots.txt
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(process.env.NODE_ENV === 'production' 
        ? 'User-agent: *\nDisallow: /api/\nDisallow: /temp/'
        : 'User-agent: *\nDisallow: /'
    );
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    const isApiRequest = req.originalUrl.startsWith('/api');
    
    if (isApiRequest) {
        res.status(404).json({ 
            error: 'API endpoint not found',
            message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
            availableEndpoints: [
                'POST /api/upload/images',
                'POST /api/process/batch',
                'GET /api/process/status/:jobId',
                'GET /api/download/zip/:jobId',
                'GET /health',
                'GET /system-info (dev only)'
            ]
        });
    } else {
        res.redirect('/');
    }
});

// Utility functions
function formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

// Graceful shutdown
const gracefulShutdown = (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    
    try {
        if (fs.existsSync(tempDir)) {
            console.log('Cleaning up temporary files...');
        }
    } catch (error) {
        console.error('Error during cleanup:', error.message);
    }
    
    console.log('Shutdown complete');
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});

// Start server
const server = app.listen(PORT, () => {
    console.log('═══════════════════════════════════════');
    console.log(`🚀 Image Converter Server Started`);
    console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Port: ${PORT}`);
    console.log(`💾 Memory Limit: ${process.env.MEMORY_LIMIT || '512'}MB`);
    console.log(`📁 Max File Size: ${(parseInt(process.env.MAX_FILE_SIZE) || 10485760) / 1024 / 1024}MB`);
    console.log(`📸 Max Files: ${process.env.MAX_FILES || '100'}`);
    console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
    if (process.env.NODE_ENV !== 'production') {
        console.log(`🐛 Debug Rate Limits: http://localhost:${PORT}/debug/rate-limits`);
        console.log(`📊 System Info: http://localhost:${PORT}/system-info`);
    }
    console.log(`⚡ Rate Limiting: ${process.env.NODE_ENV === 'production' ? 'Production Mode' : 'Development Mode (Relaxed)'}`);
    console.log('═══════════════════════════════════════');
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('❌ Server startup error:', error);
        process.exit(1);
    }
});

module.exports = app;