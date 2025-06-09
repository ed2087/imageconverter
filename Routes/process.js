// const express = require('express');
// const router = express.Router();
// const upload = require('../Config/multer');
// const { validateFiles, validateSettings } = require('../Middleware/fileValidation');
// const processController = require('../Controllers/processController');

// // Start batch processing
// router.post('/batch',
//     upload.array('images', parseInt(process.env.MAX_FILES) || 100),
//     validateFiles,
//     validateSettings,
//     processController.startBatchProcessing
// );

// // Get job status
// router.get('/status/:jobId', processController.getJobStatus);

// // Cancel job
// router.delete('/cancel/:jobId', processController.cancelJob);

// // Retry job
// router.post('/retry/:jobId', processController.retryJob);

// // Get job list (for admin/debugging)
// router.get('/jobs', processController.getJobList);

// // System status endpoint
// router.get('/system/status', (req, res) => {
//     try {
//         const status = processController.getSystemStatus();
//         res.json({
//             success: true,
//             ...status,
//             timestamp: new Date().toISOString()
//         });
//     } catch (error) {
//         console.error('System status error:', error);
//         res.status(500).json({
//             error: 'Failed to get system status',
//             message: error.message
//         });
//     }
// });

// // Health check endpoint for monitoring
// router.get('/health', (req, res) => {
//     try {
//         const status = processController.getSystemStatus();
//         const isHealthy = status.activeJobs < 50 && status.totalJobs < 1000; // Adjust thresholds as needed
        
//         res.status(isHealthy ? 200 : 503).json({
//             status: isHealthy ? 'healthy' : 'degraded',
//             activeJobs: status.activeJobs,
//             totalJobs: status.totalJobs,
//             memoryUsage: {
//                 used: Math.round(status.memoryUsage.heapUsed / 1024 / 1024),
//                 total: Math.round(status.memoryUsage.heapTotal / 1024 / 1024)
//             },
//             uptime: Math.round(status.uptime),
//             timestamp: new Date().toISOString()
//         });
//     } catch (error) {
//         console.error('Health check error:', error);
//         res.status(500).json({
//             status: 'error',
//             message: error.message,
//             timestamp: new Date().toISOString()
//         });
//     }
// });

// module.exports = router;




const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const upload = require('../config/multer');
const { validateFiles, validateSettings } = require('../Middleware/fileValidation');
const processController = require('../Controllers/processController');

// Status check rate limiter
const statusLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
        error: 'Status check limit exceeded',
        message: 'Too many status checks, please reduce polling frequency.',
        retryAfter: 60
    }
});

// Start batch processing
router.post('/batch',
    upload.array('images', parseInt(process.env.MAX_FILES) || 100),
    validateFiles,
    validateSettings,
    processController.startBatchProcessing
);

// Get job status - with more lenient rate limiting
router.get('/status/:jobId', statusLimiter, processController.getJobStatus);

// Cancel job
router.delete('/cancel/:jobId', processController.cancelJob);

// Retry job
router.post('/retry/:jobId', processController.retryJob);

// Get job list (for admin/debugging)
router.get('/jobs', processController.getJobList);

// System status endpoint
router.get('/system/status', (req, res) => {
    try {
        const status = processController.getSystemStatus();
        res.json({
            success: true,
            ...status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('System status error:', error);
        res.status(500).json({
            error: 'Failed to get system status',
            message: error.message
        });
    }
});

module.exports = router;