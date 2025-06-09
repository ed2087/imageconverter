// Heroku-specific configuration and optimizations
const fs = require('fs');
const path = require('path');

class HerokuConfig {
    static initialize() {
        // Set up memory monitoring
        this.setupMemoryMonitoring();
        
        // Set up graceful shutdown
        this.setupGracefulShutdown();
        
        // Set up periodic cleanup
        this.setupPeriodicCleanup();
        
        // Optimize Sharp for Heroku
        this.optimizeSharp();
    }

    static setupMemoryMonitoring() {
        const memoryLimit = parseInt(process.env.MEMORY_LIMIT) || 512; // MB
        const warningThreshold = memoryLimit * 0.8; // 80% of limit
        
        setInterval(() => {
            const usage = process.memoryUsage();
            const usedMB = usage.heapUsed / 1024 / 1024;
            
            if (usedMB > warningThreshold) {
                console.warn(`Memory usage high: ${usedMB.toFixed(2)}MB`);
                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }
            }
        }, 30000); // Check every 30 seconds
    }

    static setupGracefulShutdown() {
        const gracefulShutdown = () => {
            console.log('Received shutdown signal, cleaning up...');
            
            // Clean up temp files
            this.cleanupTempFiles();
            
            // Exit gracefully
            process.exit(0);
        };

        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
    }

    static setupPeriodicCleanup() {
        // Clean up temp files every hour
        setInterval(() => {
            this.cleanupTempFiles();
        }, 3600000); // 1 hour
    }

    static cleanupTempFiles() {
        const tempDir = path.join(__dirname, '..', 'temp');
        
        if (!fs.existsSync(tempDir)) return;
        
        try {
            const now = Date.now();
            const maxAge = 2 * 60 * 60 * 1000; // 2 hours
            
            const cleanupDirectory = (dir) => {
                const files = fs.readdirSync(dir);
                
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isDirectory()) {
                        cleanupDirectory(filePath);
                        
                        // Remove empty directories
                        try {
                            fs.rmdirSync(filePath);
                        } catch (e) {
                            // Directory not empty, ignore
                        }
                    } else {
                        // Remove old files
                        if (now - stats.mtime.getTime() > maxAge) {
                            try {
                                fs.unlinkSync(filePath);
                                console.log(`Cleaned up old file: ${filePath}`);
                            } catch (e) {
                                console.error(`Failed to cleanup file ${filePath}:`, e);
                            }
                        }
                    }
                });
            };
            
            cleanupDirectory(tempDir);
            
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    static optimizeSharp() {
        const sharp = require('sharp');
        
        // Optimize Sharp for Heroku's limited memory
        sharp.cache(false); // Disable cache to save memory
        sharp.simd(false);  // Disable SIMD for compatibility
        
        // Set concurrency based on available memory
        const memoryLimit = parseInt(process.env.MEMORY_LIMIT) || 512;
        const concurrency = Math.max(1, Math.floor(memoryLimit / 128)); // 128MB per thread
        sharp.concurrency(concurrency);
        
        console.log(`Sharp configured with concurrency: ${concurrency}`);
    }
}

module.exports = HerokuConfig;