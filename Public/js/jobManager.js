class JobManager {
    constructor(app) {
        this.app = app;
        this.currentJob = null;
        this.cancelRequested = false;
    }

    async startJob(formData) {
        try {
            const response = await fetch('/api/process/batch', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to start processing');
            }

            const { jobId } = await response.json();
            this.currentJob = jobId;
            this.cancelRequested = false;
            
            return jobId;
        } catch (error) {
            console.error('Job start error:', error);
            throw error;
        }
    }

    async cancelCurrentJob() {
        if (!this.currentJob) return;

        try {
            this.cancelRequested = true;
            
            const response = await fetch(`/api/process/cancel/${this.currentJob}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.app.showToast('Processing cancelled', 'warning');
                this.app.hideProcessingDashboard();
                this.app.resetProcessButton();
            } else {
                throw new Error('Failed to cancel job');
            }
        } catch (error) {
            console.error('Cancel job error:', error);
            this.app.showToast('Failed to cancel processing', 'error');
        }
    }

    async retryJob(jobId) {
        try {
            const response = await fetch(`/api/process/retry/${jobId}`, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error('Failed to retry job');
            }

            const { jobId: newJobId } = await response.json();
            this.currentJob = newJobId;
            
            return newJobId;
        } catch (error) {
            console.error('Retry job error:', error);
            throw error;
        }
    }

    async getJobStatus(jobId) {
        try {
            const response = await fetch(`/api/process/status/${jobId}`);
            
            if (!response.ok) {
                throw new Error('Failed to get job status');
            }

            return await response.json();
        } catch (error) {
            console.error('Get job status error:', error);
            throw error;
        }
    }

    isCancelRequested() {
        return this.cancelRequested;
    }

    clearCurrentJob() {
        this.currentJob = null;
        this.cancelRequested = false;
    }
}

// Add to the main app initialization
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ImageConverter();
    window.jobManager = new JobManager(window.app);
});