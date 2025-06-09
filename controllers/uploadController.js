const path = require('path');
const fs = require('fs');

class UploadController {
    async uploadFiles(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    error: 'No files uploaded',
                    message: 'Please select at least one image file'
                });
            }

            // Validate uploaded files
            const validFiles = [];
            const errors = [];

            for (const file of req.files) {
                try {
                    // Check if file exists and is readable
                    if (!fs.existsSync(file.path)) {
                        errors.push(`File ${file.originalname} upload failed`);
                        continue;
                    }

                    // Get file stats
                    const stats = fs.statSync(file.path);
                    
                    validFiles.push({
                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        originalName: file.originalname,
                        filename: file.filename,
                        path: file.path,
                        size: stats.size,
                        mimetype: file.mimetype,
                        uploadedAt: new Date().toISOString()
                    });

                } catch (error) {
                    errors.push(`Error processing ${file.originalname}: ${error.message}`);
                }
            }

            res.json({
                success: true,
                files: validFiles,
                errors: errors.length > 0 ? errors : undefined,
                message: `Successfully uploaded ${validFiles.length} files${errors.length > 0 ? ` with ${errors.length} errors` : ''}`
            });

        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({
                error: 'Upload failed',
                message: error.message
            });
        }
    }

async uploadWatermark(req, res) {
    console.log('🖼️ Watermark upload request received');
    
    try {
        if (!req.file) {
            console.log('❌ No file in request');
            return res.status(400).json({
                error: 'No watermark file uploaded',
                message: 'Please select a watermark image'
            });
        }

        const file = req.file;
        
        console.log('📁 File details:', {
            filename: file.filename,
            originalname: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            path: file.path
        });
        
        // Validate it's an image
        if (!file.mimetype.startsWith('image/')) {
            console.log('❌ Invalid file type:', file.mimetype);
            
            // Clean up uploaded file
            if (fs.existsSync(file.path)) {
                try {
                    fs.unlinkSync(file.path);
                    console.log('🗑️ Cleaned up invalid file:', file.path);
                } catch (cleanupError) {
                    console.error('⚠️ Failed to cleanup file:', cleanupError);
                }
            }
            
            return res.status(400).json({
                error: 'Invalid file type',
                message: 'Watermark must be an image file'
            });
        }

        // Validate file size (max 5MB for watermarks)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            console.log('❌ File too large:', file.size);
            
            // Clean up uploaded file
            if (fs.existsSync(file.path)) {
                try {
                    fs.unlinkSync(file.path);
                    console.log('🗑️ Cleaned up oversized file:', file.path);
                } catch (cleanupError) {
                    console.error('⚠️ Failed to cleanup file:', cleanupError);
                }
            }
            
            return res.status(400).json({
                error: 'File too large',
                message: 'Watermark image must be smaller than 5MB'
            });
        }

        // Verify file actually exists
        if (!fs.existsSync(file.path)) {
            console.log('❌ Uploaded file not found:', file.path);
            return res.status(500).json({
                error: 'Upload failed',
                message: 'File was not saved properly'
            });
        }

        const watermarkData = {
            id: `watermark-${Date.now()}`,
            filename: file.filename,
            path: file.path,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            uploadedAt: new Date().toISOString()
        };

        console.log('✅ Watermark uploaded successfully:', watermarkData.filename);

        res.json({
            success: true,
            watermark: watermarkData
        });

    } catch (error) {
        console.error('❌ Watermark upload error:', error);
        
        // Clean up file if it exists
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
                console.log('🗑️ Cleaned up file after error:', req.file.path);
            } catch (cleanupError) {
                console.error('⚠️ Failed to cleanup file after error:', cleanupError);
            }
        }
        
        res.status(500).json({
            error: 'Watermark upload failed',
            message: error.message
        });
    }
}

    async getUploadStatus(req, res) {
        try {
            const { uploadId } = req.params;
            
            // In a real implementation, you might store upload status in Redis or database
            // For now, we'll return a simple status
            
            res.json({
                uploadId,
                status: 'completed',
                message: 'Upload completed successfully'
            });

        } catch (error) {
            console.error('Upload status error:', error);
            res.status(500).json({
                error: 'Failed to get upload status',
                message: error.message
            });
        }
    }

    async cleanupUploads(req, res) {
        try {
            const { uploadIds } = req.body;
            
            if (!Array.isArray(uploadIds)) {
                return res.status(400).json({
                    error: 'Invalid input',
                    message: 'uploadIds must be an array'
                });
            }

            const cleaned = [];
            const errors = [];

            for (const uploadId of uploadIds) {
                try {
                    // In a real implementation, you'd look up files by uploadId
                    // For now, we'll just acknowledge the cleanup request
                    cleaned.push(uploadId);
                } catch (error) {
                    errors.push({ uploadId, error: error.message });
                }
            }

            res.json({
                success: true,
                cleaned,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            console.error('Cleanup error:', error);
            res.status(500).json({
                error: 'Cleanup failed',
                message: error.message
            });
        }
    }
}

module.exports = new UploadController();