const path = require('path');
const fs = require('fs');

class DownloadController {
    constructor() {
        this.downloadCounts = new Map();
        
        // Bind methods to preserve 'this' context
        this.downloadZip = this.downloadZip.bind(this);
        this.downloadSingle = this.downloadSingle.bind(this);
        this.getDownloadInfo = this.getDownloadInfo.bind(this);
        this.listDownloads = this.listDownloads.bind(this);
        this.deleteDownload = this.deleteDownload.bind(this);
    }

    async downloadZip(req, res) {
        try {
            const { jobId } = req.params;
            console.log(`📥 Download request for job: ${jobId}`);
            
            const zipPath = path.join(__dirname, '..', 'temp', 'downloads', `${jobId}.zip`);
            console.log(`📁 Looking for ZIP at: ${zipPath}`);
            
            if (!fs.existsSync(zipPath)) {
                console.error(`❌ ZIP file not found: ${zipPath}`);
                return res.status(404).json({
                    error: 'Download not found',
                    message: 'The requested download is no longer available'
                });
            }

            // Get file stats
            const stats = fs.statSync(zipPath);
            const filename = `converted-images-${jobId}.zip`;

            // Track download
            const currentCount = this.downloadCounts.get(jobId) || 0;
            this.downloadCounts.set(jobId, currentCount + 1);
            
            console.log(`✅ Starting download: ${filename} (${stats.size} bytes)`);

            // Set headers for download
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Cache-Control', 'no-cache');

            // Stream the file
            const stream = fs.createReadStream(zipPath);
            
            stream.on('error', (error) => {
                console.error('Download stream error:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Download failed',
                        message: 'Error reading download file'
                    });
                }
            });

            stream.on('end', () => {
                console.log(`✅ Download completed: ${filename}`);
            });

            stream.pipe(res);

        } catch (error) {
            console.error('Download error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Download failed',
                    message: error.message
                });
            }
        }
    }

    async downloadSingle(req, res) {
        try {
            const { jobId, filename } = req.params;
            
            if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                return res.status(400).json({
                    error: 'Invalid filename',
                    message: 'Filename contains invalid characters'
                });
            }

            const filePath = path.join(__dirname, '..', 'temp', 'processed', filename);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    error: 'File not found',
                    message: 'The requested file is no longer available'
                });
            }

            const stats = fs.statSync(filePath);
            const ext = path.extname(filename).toLowerCase();
            const contentTypeMap = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.avif': 'image/avif',
                '.tiff': 'image/tiff'
            };
            
            const contentType = contentTypeMap[ext] || 'application/octet-stream';

            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', stats.size);

            const stream = fs.createReadStream(filePath);
            stream.pipe(res);

        } catch (error) {
            console.error('Single file download error:', error);
            res.status(500).json({
                error: 'Download failed',
                message: error.message
            });
        }
    }

    async getDownloadInfo(req, res) {
        try {
            const { jobId } = req.params;
            const zipPath = path.join(__dirname, '..', 'temp', 'downloads', `${jobId}.zip`);
            
            if (!fs.existsSync(zipPath)) {
                return res.status(404).json({
                    error: 'Download not found',
                    message: 'The requested download is no longer available'
                });
            }

            const stats = fs.statSync(zipPath);
            const downloadCount = this.downloadCounts.get(jobId) || 0;

            res.json({
                success: true,
                jobId,
                filename: `converted-images-${jobId}.zip`,
                size: stats.size,
                downloadCount,
                createdAt: stats.birthtime,
                downloadUrl: `/api/download/zip/${jobId}`
            });

        } catch (error) {
            console.error('Download info error:', error);
            res.status(500).json({
                error: 'Failed to get download info',
                message: error.message
            });
        }
    }

    async listDownloads(req, res) {
        try {
            const downloadsDir = path.join(__dirname, '..', 'temp', 'downloads');
            
            if (!fs.existsSync(downloadsDir)) {
                return res.json({
                    success: true,
                    downloads: []
                });
            }

            const files = fs.readdirSync(downloadsDir);
            const downloads = [];

            for (const file of files) {
                if (path.extname(file) === '.zip') {
                    const filePath = path.join(downloadsDir, file);
                    const stats = fs.statSync(filePath);
                    const jobId = path.parse(file).name;

                    downloads.push({
                        jobId,
                        filename: file,
                        size: stats.size,
                        createdAt: stats.birthtime,
                        downloadCount: this.downloadCounts.get(jobId) || 0,
                        downloadUrl: `/api/download/zip/${jobId}`
                    });
                }
            }

            downloads.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            res.json({
                success: true,
                downloads
            });

        } catch (error) {
            console.error('List downloads error:', error);
            res.status(500).json({
                error: 'Failed to list downloads',
                message: error.message
            });
        }
    }

    async deleteDownload(req, res) {
        try {
            const { jobId } = req.params;
            const zipPath = path.join(__dirname, '..', 'temp', 'downloads', `${jobId}.zip`);
            
            if (!fs.existsSync(zipPath)) {
                return res.status(404).json({
                    error: 'Download not found',
                    message: 'The requested download does not exist'
                });
            }

            fs.unlinkSync(zipPath);
            this.downloadCounts.delete(jobId);

            res.json({
                success: true,
                message: 'Download deleted successfully'
            });

        } catch (error) {
            console.error('Delete download error:', error);
            res.status(500).json({
                error: 'Failed to delete download',
                message: error.message
            });
        }
    }
}

// ✅ Create and export singleton instance
module.exports = new DownloadController();