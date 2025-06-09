const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { validateFiles, validateSettings } = require('../middleware/fileValidation');
const uploadController = require('../controllers/uploadController');

// Upload multiple images
router.post('/images', 
    upload.array('images', parseInt(process.env.MAX_FILES) || 100),
    validateFiles,
    uploadController.uploadFiles
);

// Upload watermark image
router.post('/watermark',
    upload.single('watermark'),
    uploadController.uploadWatermark
);

// Get upload status
router.get('/status/:uploadId', uploadController.getUploadStatus);

// Cleanup uploads
router.post('/cleanup', uploadController.cleanupUploads);

module.exports = router;