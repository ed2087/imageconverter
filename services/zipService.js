const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

class ZipService {
    async createZip(files, outputPath) {
        return new Promise((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {
                zlib: { level: 6 } // Compression level
            });

            output.on('close', () => {
                resolve({
                    path: outputPath,
                    size: archive.pointer()
                });
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // Add files to archive
            files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    archive.file(file.path, { name: file.name });
                }
            });

            archive.finalize();
        });
    }

    async createBatchZip(processedFiles, jobId) {
        const tempDir = path.join(__dirname, '..', 'temp');
        const zipPath = path.join(tempDir, 'downloads', `${jobId}.zip`);
        
        // Ensure downloads directory exists
        const downloadsDir = path.dirname(zipPath);
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        // Filter successful files and prepare for zipping
        const filesToZip = processedFiles
            .filter(file => file.success && fs.existsSync(file.outputPath))
            .map(file => ({
                path: file.outputPath,
                name: file.outputName
            }));

        if (filesToZip.length === 0) {
            throw new Error('No processed files available for download');
        }

        return await this.createZip(filesToZip, zipPath);
    }

    cleanupFile(filePath, delay = 300000) { // Default 5 minutes
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up file: ${filePath}`);
                } catch (error) {
                    console.error(`Failed to cleanup file ${filePath}:`, error);
                }
            }
        }, delay);
    }

    cleanupDirectory(dirPath, delay = 600000) { // Default 10 minutes
        setTimeout(() => {
            if (fs.existsSync(dirPath)) {
                try {
                    fs.rmSync(dirPath, { recursive: true, force: true });
                    console.log(`Cleaned up directory: ${dirPath}`);
                } catch (error) {
                    console.error(`Failed to cleanup directory ${dirPath}:`, error);
                }
            }
        }, delay);
    }
}

module.exports = ZipService;