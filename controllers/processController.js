const ImageProcessor = require('../services/imageProcessor');
const ZipService = require('../services/zipService');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const jobStatus = {}; // You may store this elsewhere if needed
const zipService = new ZipService();
const imageProcessor = new ImageProcessor();


class ProcessController {
    constructor() {
        this.imageProcessor = new ImageProcessor();
        this.zipService = new ZipService();
        this.jobs = new Map(); // In production, use Redis or database
        this.activeJobs = new Set();
        
        // Bind all methods to maintain proper 'this' context
        this.startBatchProcessing = this.startBatchProcessing.bind(this);
        this.processJob = this.processJob.bind(this);
        this.getJobStatus = this.getJobStatus.bind(this);
        this.cancelJob = this.cancelJob.bind(this);
        this.getJobList = this.getJobList.bind(this);
        this.retryJob = this.retryJob.bind(this);
        this.calculateCompressionRatio = this.calculateCompressionRatio.bind(this);
        this.scheduleCleanup = this.scheduleCleanup.bind(this);
        this.cleanupJob = this.cleanupJob.bind(this);
        this.cleanupJobFiles = this.cleanupJobFiles.bind(this);
        this.getSystemStatus = this.getSystemStatus.bind(this);
    }

    async startBatchProcessing(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    error: 'No files to process',
                    message: 'Please upload images first'
                });
            }

            const settings = req.validatedSettings;
            const jobId = uuidv4();
            
            // Initialize job status
            const job = {
                id: jobId,
                status: 'queued',
                files: req.files,
                settings: settings,
                startTime: Date.now(),
                progress: {
                    processed: 0,
                    total: req.files.length,
                    percentage: 0,
                    speed: 0,
                    eta: 0
                },
                results: [],
                downloadUrl: null,
                errors: []
            };

            this.jobs.set(jobId, job);

            // Start processing in background
            setImmediate(() => this.processJob(jobId));

            res.json({
                success: true,
                jobId: jobId,
                status: 'queued',
                totalFiles: req.files.length,
                message: 'Processing started'
            });

        } catch (error) {
            console.error('Batch processing error:', error);
            res.status(500).json({
                error: 'Failed to start processing',
                message: error.message
            });
        }
    }

async processJob(jobId) {
    try {
        const job = this.jobs.get(jobId);
        if (!job || this.activeJobs.has(jobId)) return;

        this.activeJobs.add(jobId);
        job.status = 'processing';
        job.startTime = Date.now();

        console.log(`🛠️ Starting job ${jobId} with ${job.files.length} files`);

        // Process images
        const results = await this.imageProcessor.batchProcess(
            job.files,
            job.settings,
            (progress) => {
                job.progress = {
                    ...progress,
                    percentage: Math.round(progress.progress)
                };
                // ✅ FIX: Update the job in the Map
                this.jobs.set(jobId, { ...job });
            }
        );

        job.results = results;
        job.progress.processed = results.length;
        job.progress.percentage = 100;

        // Separate results
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        console.log(`✅ Job ${jobId} done: ${successful.length} succeeded, ${failed.length} failed`);

        // Create ZIP if any succeeded
        if (successful.length > 0) {
            try {
                const zipResult = await this.zipService.createBatchZip(successful, jobId);
                job.downloadUrl = `/api/download/zip/${jobId}`;
                job.zipPath = zipResult.path;
                job.zipSize = zipResult.size;
            } catch (zipError) {
                console.error('❌ ZIP creation failed:', zipError);
                job.errors.push('Failed to create download ZIP');
            }
        }

        // ✅ FIX: Properly set completion status
        job.status = successful.length > 0 ? 'completed' : 'failed';
        job.endTime = Date.now();
        job.duration = job.endTime - job.startTime;
        job.successCount = successful.length;
        job.failedCount = failed.length;

        // ✅ FIX: Update the job in the Map with final status
        this.jobs.set(jobId, { ...job });

        console.log(`📝 Job ${jobId} final status: ${job.status}`);

        // Cleanup in background
        this.scheduleCleanup(jobId);

    } catch (error) {
        console.error(`❌ Job ${jobId} crashed:`, error);
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = 'failed';
            job.error = error.message;
            job.endTime = Date.now();
            // ✅ FIX: Update the job in the Map
            this.jobs.set(jobId, { ...job });
        }
    } finally {
        this.activeJobs.delete(jobId);
    }
}


    async getJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            const job = this.jobs.get(jobId);

            if (!job) {
                return res.status(404).json({
                    error: 'Job not found',
                    message: 'The specified job ID does not exist'
                });
            }

            // Return sanitized job status (no file paths for security)
            const response = {
                jobId: job.id,
                status: job.status,
                progress: job.progress,
                startTime: job.startTime,
                endTime: job.endTime,
                duration: job.duration,
                successCount: job.successCount,
                failedCount: job.failedCount,
                downloadUrl: job.downloadUrl,
                errors: job.errors
            };

            // Add results summary for completed jobs
            if (job.status === 'completed' && job.results) {
                response.summary = {
                    totalSize: job.results.reduce((sum, r) => sum + (r.originalSize || 0), 0),
                    processedSize: job.results.reduce((sum, r) => sum + (r.processedSize || 0), 0),
                    compressionRatio: this.calculateCompressionRatio(job.results)
                };
            }

            res.json(response);

        } catch (error) {
            console.error('Job status error:', error);
            res.status(500).json({
                error: 'Failed to get job status',
                message: error.message
            });
        }
    }

    async cancelJob(req, res) {
        try {
            const { jobId } = req.params;
            const job = this.jobs.get(jobId);

            if (!job) {
                return res.status(404).json({
                    error: 'Job not found',
                    message: 'The specified job ID does not exist'
                });
            }

            if (job.status === 'completed' || job.status === 'failed') {
                return res.status(400).json({
                    error: 'Job already finished',
                    message: 'Cannot cancel a job that has already completed'
                });
            }

            job.status = 'cancelled';
            job.endTime = Date.now();
            this.activeJobs.delete(jobId);

            // Cleanup any partially processed files
            this.cleanupJobFiles(job);

            res.json({
                success: true,
                message: 'Job cancelled successfully'
            });

        } catch (error) {
            console.error('Job cancellation error:', error);
            res.status(500).json({
                error: 'Failed to cancel job',
                message: error.message
            });
        }
    }

    async getJobList(req, res) {
        try {
            const { status, limit = 50 } = req.query;
            let jobs = Array.from(this.jobs.values());

            // Filter by status if specified
            if (status) {
                jobs = jobs.filter(job => job.status === status);
            }

            // Sort by start time (newest first)
            jobs.sort((a, b) => b.startTime - a.startTime);

            // Limit results
            jobs = jobs.slice(0, parseInt(limit));

            // Return sanitized job list
            const jobList = jobs.map(job => ({
                jobId: job.id,
                status: job.status,
                totalFiles: job.files ? job.files.length : 0,
                progress: job.progress,
                startTime: job.startTime,
                endTime: job.endTime,
                successCount: job.successCount,
                failedCount: job.failedCount
            }));

            res.json({
                success: true,
                jobs: jobList,
                total: this.jobs.size
            });

        } catch (error) {
            console.error('Job list error:', error);
            res.status(500).json({
                error: 'Failed to get job list',
                message: error.message
            });
        }
    }

    async retryJob(req, res) {
        try {
            const { jobId } = req.params;
            const originalJob = this.jobs.get(jobId);

            if (!originalJob) {
                return res.status(404).json({
                    error: 'Job not found',
                    message: 'The specified job ID does not exist'
                });
            }

            if (originalJob.status === 'processing') {
                return res.status(400).json({
                    error: 'Job is running',
                    message: 'Cannot retry a job that is currently processing'
                });
            }

            // Create new job with same settings but new ID
            const newJobId = uuidv4();
            const newJob = {
                ...originalJob,
                id: newJobId,
                status: 'queued',
                startTime: null,
                endTime: null,
                duration: null,
                progress: {
                    processed: 0,
                    total: originalJob.files.length,
                    percentage: 0,
                    speed: 0,
                    eta: 0
                },
                results: [],
                downloadUrl: null,
                errors: []
            };

            this.jobs.set(newJobId, newJob);

            // Start processing
            setImmediate(() => this.processJob(newJobId));

            res.json({
                success: true,
                jobId: newJobId,
                originalJobId: jobId,
                message: 'Job retry started'
            });

        } catch (error) {
            console.error('Job retry error:', error);
            res.status(500).json({
                error: 'Failed to retry job',
                message: error.message
            });
        }
    }

    // Utility methods
    calculateCompressionRatio(results) {
        const totalOriginal = results.reduce((sum, r) => sum + (r.originalSize || 0), 0);
        const totalProcessed = results.reduce((sum, r) => sum + (r.processedSize || 0), 0);
        
        if (totalOriginal === 0) return 0;
        return Math.round(((totalOriginal - totalProcessed) / totalOriginal) * 100);
    }

    scheduleCleanup(jobId, delay = 1800000) { // 30 minutes default
        setTimeout(() => {
            this.cleanupJob(jobId);
        }, delay);
    }

    cleanupJob(jobId) {
        try {
            const job = this.jobs.get(jobId);
            if (!job) return;

            console.log(`Cleaning up job ${jobId}`);

            // Clean up uploaded files
            if (job.files) {
                job.files.forEach(file => {
                    if (file.path && fs.existsSync(file.path)) {
                        try {
                            fs.unlinkSync(file.path);
                        } catch (error) {
                            console.error(`Failed to cleanup uploaded file ${file.path}:`, error);
                        }
                    }
                });
            }

            // Clean up processed files
            if (job.results) {
                job.results.forEach(result => {
                    if (result.outputPath && fs.existsSync(result.outputPath)) {
                        try {
                            fs.unlinkSync(result.outputPath);
                        } catch (error) {
                            console.error(`Failed to cleanup processed file ${result.outputPath}:`, error);
                        }
                    }
                });
            }

            // Clean up ZIP file
            if (job.zipPath && fs.existsSync(job.zipPath)) {
                try {
                    fs.unlinkSync(job.zipPath);
                } catch (error) {
                    console.error(`Failed to cleanup ZIP file ${job.zipPath}:`, error);
                }
            }

            // Remove job from memory
            this.jobs.delete(jobId);

        } catch (error) {
            console.error(`Error cleaning up job ${jobId}:`, error);
        }
    }

    cleanupJobFiles(job) {
        // Clean up any files associated with the job
        if (job.files) {
            job.files.forEach(file => {
                if (file.path && fs.existsSync(file.path)) {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (error) {
                        console.error(`Failed to cleanup file ${file.path}:`, error);
                    }
                }
            });
        }
    }

    // Health check method
    getSystemStatus() {
        return {
            activeJobs: this.activeJobs.size,
            totalJobs: this.jobs.size,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime()
        };
    }
}

// Create and export a properly initialized instance
const processController = new ProcessController();
module.exports = processController;