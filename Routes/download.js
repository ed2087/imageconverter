const express = require('express');
const router = express.Router();
const downloadController = require('../Controllers/downloadController');

// Download ZIP file
router.get('/zip/:jobId', downloadController.downloadZip);

// Download single file
router.get('/file/:jobId/:filename', downloadController.downloadSingle);

// Get download info
router.get('/info/:jobId', downloadController.getDownloadInfo);

// List all downloads (for admin)
router.get('/list', downloadController.listDownloads);

// Delete download
router.delete('/zip/:jobId', downloadController.deleteDownload);

module.exports = router;