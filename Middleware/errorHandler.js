const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Multer errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                message: 'File size exceeds the maximum allowed limit'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: 'Too many files',
                message: 'Number of files exceeds the maximum allowed limit'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                error: 'Unexpected file',
                message: 'Unexpected file field'
            });
        }
    }

    // File validation errors
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({
            error: 'Invalid file type',
            message: err.message
        });
    }

    // Sharp/Image processing errors
    if (err.message && err.message.includes('Input file')) {
        return res.status(400).json({
            error: 'Invalid image file',
            message: 'The uploaded file is not a valid image or is corrupted'
        });
    }

    // Default error
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
};

module.exports = errorHandler;