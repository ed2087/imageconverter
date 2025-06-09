const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class ImageProcessor {
    constructor() {
        this.queue = [];
        this.processing = false;
    }

async processImage(inputPath, outputPath, settings, index = 0) {
    try {
        // Load the base image
        const baseImage = sharp(inputPath);
        const metadata = await baseImage.metadata();

        // Apply resize if needed
        let image = sharp(inputPath);
        if (settings.resize) {
            image = this.applyResize(image, settings.resize, metadata);
        }

        // Convert to buffer and create new sharp instance
        let imageBuffer = await image.toBuffer();

        // Apply watermark if requested
        if (settings.watermark && settings.watermark.type !== 'none') {
            const watermarked = await this.applyWatermark(sharp(imageBuffer), settings.watermark, metadata);
            imageBuffer = await watermarked.toBuffer(); // ensure it's a raw buffer again
        }

        // Final sharp instance
        let finalImage = sharp(imageBuffer);

        // Apply format settings
        finalImage = this.applyFormat(finalImage, settings);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save to disk
        await finalImage.toFile(outputPath);

        const stats = fs.statSync(outputPath);
        return {
            success: true,
            originalSize: fs.statSync(inputPath).size,
            processedSize: stats.size,
            dimensions: {
                width: metadata.width,
                height: metadata.height
            }
        };

    } catch (error) {
        console.error(`❌ Error processing image ${inputPath}:`, error);
        throw new Error(`Failed to process image: ${error.message}`);
    }
}



    applyResize(image, resizeSettings, metadata) {
        const { width, height, fit } = resizeSettings;
        
        // Skip resize if dimensions are the same and fit is 'inside'
        if (fit === 'inside' && metadata.width <= width && metadata.height <= height) {
            return image;
        }
        
        return image.resize({
            width: width,
            height: height,
            fit: sharp.fit[fit] || sharp.fit.inside,
            withoutEnlargement: fit === 'inside'
        });
    }

async applyWatermark(image, watermarkSettings, metadata) {
    const { type, text, font, position, opacity, imagePath } = watermarkSettings;

    console.log(`🧩 Applying watermark type: ${type}`);

    if (type === 'text' && text) {
        console.log(`📝 Text watermark: "${text}", font: ${font}, position: ${position}, opacity: ${opacity}`);
        return this.applyTextWatermark(image, { text, font, position, opacity }, metadata);
    } else if (type === 'image' && imagePath) {
        console.log(`🖼️ Image watermark path: ${imagePath}, position: ${position}, opacity: ${opacity}`);
        return this.applyImageWatermark(image, { imagePath, position, opacity }, metadata);
    }

    console.log('⚠️ No valid watermark type found. Skipping...');
    return image;
}


async applyTextWatermark(image, settings, metadata) {
    const {
        text = 'Sample Watermark',
        font = 'Arial',
        position = 'center',
        opacity = 0.5
    } = settings;

    const safeOpacity = isNaN(opacity) ? 0.5 : parseFloat(opacity);
    
    // ✅ FIX: Much smaller font size calculation
    const fontSize = Math.max(Math.min(metadata.width, metadata.height) * 0.01, 7); // Reduced from 0.05 to 0.02
    
    // ✅ FIX: Better width estimation
    const estimatedWidth = Math.min(metadata.width * 5, text.length * fontSize * 1); // Reduced multipliers
    const estimatedHeight = fontSize * 1.5; // Reduced line height

    const textSvg = Buffer.from(`
        <svg width="${estimatedWidth}" height="${estimatedHeight}">
            <style>
                .watermark {
                    font-family: ${font}, Arial, sans-serif;
                    font-size: ${fontSize}px;
                    font-weight: bold;
                    fill: white;
                    fill-opacity: ${safeOpacity};
                    text-anchor: middle;
                    dominant-baseline: central;
                }
            </style>
            <text x="50%" y="50%" class="watermark">
                ${text}
            </text>
        </svg>
    `);

    const gravity = this.getGravityFromPosition(position);

    try {
        console.log(`📝 Applying text watermark: "${text}" - Font: ${fontSize}px, Size: ${estimatedWidth}x${estimatedHeight}`);
        
        return await image.composite([{
            input: textSvg,
            gravity,
            blend: 'over'
        }]);
    } catch (err) {
        console.error('❌ Failed to apply text watermark:', err);
        throw err;
    }
}




async applyImageWatermark(image, settings, baseMeta) {
    const {
        imagePath,
        position = 'southeast',
        opacity = 0.5
    } = settings;

    if (!imagePath || !fs.existsSync(imagePath)) {
        console.warn('⚠️ Watermark image not found:', imagePath);
        return image;
    }

    console.log('🖼️ Loading watermark:', imagePath);

    // Get main image as buffer and get real dimensions
    const baseBuffer = await image.toBuffer();
    const baseInfo = await sharp(baseBuffer).metadata();
    console.log(`📏 Base image: ${baseInfo.width}x${baseInfo.height}`);

    // Load watermark
    let watermark = sharp(imagePath).png();
    let watermarkBuffer = await watermark.toBuffer();
    let watermarkInfo = await sharp(watermarkBuffer).metadata();
    console.log(`💧 Watermark before resize: ${watermarkInfo.width}x${watermarkInfo.height}`);

    // Resize watermark if too large
    if (
        watermarkInfo.width > baseInfo.width ||
        watermarkInfo.height > baseInfo.height
    ) {
        const maxWidth = Math.floor(baseInfo.width * 0.5);
        const maxHeight = Math.floor(baseInfo.height * 0.5);

        console.log(`🔧 Resizing watermark to max ${maxWidth}x${maxHeight}...`);

        watermarkBuffer = await sharp(watermarkBuffer)
            .resize({
                width: maxWidth,
                height: maxHeight,
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();

        watermarkInfo = await sharp(watermarkBuffer).metadata();
        console.log(`✅ Watermark after resize: ${watermarkInfo.width}x${watermarkInfo.height}`);
    } else {
        console.log('ℹ️ No resize needed for watermark');
    }

    const gravity = this.getGravityFromPosition(position);

    try {
        const composited = await sharp(baseBuffer).composite([
            {
                input: watermarkBuffer,
                gravity,
                blend: 'over',
                ...(opacity !== undefined ? { opacity: parseFloat(opacity) / 100 } : {})
            }
        ]);
        console.log('✅ Watermark composited successfully');
        return composited;
    } catch (compositeError) {
        console.error('❌ Composite failed:', compositeError);
        throw compositeError;
    }
}

    getGravityFromPosition(position) {
        const gravityMap = {
            'center': 'center',
            'north': 'north',
            'northeast': 'northeast',
            'east': 'east',
            'southeast': 'southeast',
            'south': 'south',
            'southwest': 'southwest',
            'west': 'west',
            'northwest': 'northwest'
        };
        
        return gravityMap[position] || 'southeast';
    }

    applyFormat(image, settings) {
        const { format, quality } = settings;
        
        switch (format.toLowerCase()) {
            case 'webp':
                return image.webp({
                    quality: quality,
                    effort: 4,
                    smartSubsample: true
                });
                
            case 'jpeg':
            case 'jpg':
                return image.jpeg({
                    quality: quality,
                    progressive: true,
                    mozjpeg: true
                });
                
            case 'png':
                return image.png({
                    compressionLevel: Math.round((100 - quality) / 10),
                    progressive: true
                });
                
            case 'avif':
                return image.avif({
                    quality: quality,
                    effort: 4
                });
                
            case 'tiff':
                return image.tiff({
                    quality: quality,
                    compression: 'lzw'
                });
                
            default:
                return image.webp({ quality: quality });
        }
    }

    generateOutputFilename(originalName, settings, index) {
        const { naming, format } = settings;
        const extension = this.getFileExtension(format);
        
        switch (naming.type) {
            case 'original':
                const baseName = path.parse(originalName).name;
                return `${baseName}.${extension}`;
                
            case 'custom':
            case 'numbered':
                const number = (naming.start + index).toString().padStart(3, '0');
                return `${naming.prefix}${number}.${extension}`;
                
            default:
                return `${path.parse(originalName).name}.${extension}`;
        }
    }

    getFileExtension(format) {
        const extensionMap = {
            'webp': 'webp',
            'jpeg': 'jpg',
            'jpg': 'jpg',
            'png': 'png',
            'avif': 'avif',
            'tiff': 'tiff'
        };
        
        return extensionMap[format.toLowerCase()] || 'webp';
    }

    async batchProcess(files, settings, progressCallback) {
        const results = [];
        const total = files.length;
        const startTime = Date.now();
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const outputFilename = this.generateOutputFilename(file.originalname, settings, i);
            const outputPath = path.join(path.dirname(file.path), '..', 'processed', outputFilename);
            
            try {
                const result = await this.processImage(file.path, outputPath, settings, i);
                
                results.push({
                    ...result,
                    originalName: file.originalname,
                    outputName: outputFilename,
                    outputPath: outputPath
                });
                
                // Calculate progress and speed
                const processed = i + 1;
                const elapsed = (Date.now() - startTime) / 1000;
                const speed = processed / elapsed;
                const eta = (total - processed) / speed;
                
                // Call progress callback
                if (progressCallback) {
                    progressCallback({
                        processed,
                        total,
                        progress: (processed / total) * 100,
                        speed,
                        eta: eta || 0,
                        status: 'processing'
                    });
                }
                
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    originalName: file.originalname,
                    outputName: outputFilename
                });
            }
        }
        
        return results;
    }
}

module.exports = ImageProcessor;