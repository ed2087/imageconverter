const path = require('path');
const fs = require('fs');

const validateFiles = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({
            error: 'No files uploaded',
            message: 'Please select at least one image file'
        });
    }

    // Validate each file
    for (const file of req.files) {
        // Check if file exists
        if (!fs.existsSync(file.path)) {
            return res.status(400).json({
                error: 'File upload failed',
                message: `File ${file.originalname} was not uploaded properly`
            });
        }

        // Check file size (additional check)
        const stats = fs.statSync(file.path);
        const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024;
        if (stats.size > maxSize) {
            return res.status(400).json({
                error: 'File too large',
                message: `File ${file.originalname} exceeds size limit`
            });
        }
    }

    next();
};

const validateSettings = (req, res, next) => {
    try {
        let settings;
        
        if (typeof req.body.settings === 'string') {
            settings = JSON.parse(req.body.settings);
        } else {
            settings = req.body.settings;
        }

        // Validate and sanitize settings
        const validatedSettings = {
            format: validateFormat(settings.format),
            quality: validateQuality(settings.quality),
            resize: validateResize(settings.resize),
            watermark: validateWatermark(settings.watermark),
            naming: validateNaming(settings.naming)
        };

        req.validatedSettings = validatedSettings;
        next();
    } catch (error) {
        return res.status(400).json({
            error: 'Invalid settings',
            message: 'Processing settings are invalid or corrupted'
        });
    }
};

function validateFormat(format) {
    const validFormats = ['webp', 'jpeg', 'png', 'avif', 'tiff'];
    return validFormats.includes(format) ? format : 'webp';
}

function validateQuality(quality) {
    const q = parseInt(quality);
    return (q >= 1 && q <= 100) ? q : 85;
}

function validateResize(resize) {
    if (!resize) return { width: 1920, height: 1080, fit: 'inside' };
    
    return {
        width: Math.max(1, Math.min(10000, parseInt(resize.width) || 1920)),
        height: Math.max(1, Math.min(10000, parseInt(resize.height) || 1080)),
        fit: ['cover', 'contain', 'fill', 'inside', 'outside'].includes(resize.fit) ? resize.fit : 'inside'
    };
}

function validateWatermark(watermark) {
    if (!watermark) return { type: 'none' };
    
    const validTypes = ['none', 'text', 'image'];
    const validPositions = ['center', 'north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
    
    return {
        type: validTypes.includes(watermark.type) ? watermark.type : 'none',
        text: typeof watermark.text === 'string' ? watermark.text.substring(0, 100) : '',
        font: typeof watermark.font === 'string' ? watermark.font : 'Arial',
        position: validPositions.includes(watermark.position) ? watermark.position : 'southeast',
        opacity: Math.max(0.1, Math.min(1, parseFloat(watermark.opacity) || 0.7))
    };
}

function validateNaming(naming) {
    if (!naming) return { type: 'original', prefix: 'image', start: 1 };
    
    const validTypes = ['original', 'custom', 'numbered'];
    
    return {
        type: validTypes.includes(naming.type) ? naming.type : 'original',
        prefix: typeof naming.prefix === 'string' ? naming.prefix.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 50) : 'image',
        start: Math.max(0, parseInt(naming.start) || 1)
    };
}

module.exports = {
    validateFiles,
    validateSettings
};