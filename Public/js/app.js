// Add this debug function at the top of your app.js file
function debugSettings() {
    console.log('=== Settings Debug ===');
    console.log('Settings panel element:', document.getElementById('settings-panel'));
    console.log('Settings toggle button:', document.getElementById('settings-toggle'));
    console.log('Settings close button:', document.getElementById('settings-close'));
    console.log('Settings overlay:', document.querySelector('.settings-overlay'));
}

class ImageConverter {
    constructor() {
        this.uploadedImages = [];
        this.settings = this.loadSettings();
        this.processing = false;
        
        this.initializeElements();
        this.bindEvents();
        this.updateSettingsUI();
        
        // Delayed setup for watermark elements
        setTimeout(() => {
            this.setupWatermarkListeners();
        }, 500);
    }

    initializeElements() {
        // Upload elements
        this.uploadZone = document.getElementById('upload-zone');
        this.fileInput = document.getElementById('file-input');
        this.cameraInput = document.getElementById('camera-input');
        this.browseBtn = document.getElementById('browse-files');
        this.cameraBtn = document.getElementById('camera-capture');
        
        // UI elements
        this.imageGrid = document.getElementById('image-grid');
        this.settingsPanel = document.getElementById('settings-panel');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.settingsClose = document.getElementById('settings-close');
        this.clearAllBtn = document.getElementById('clear-all');
        
        // Progress elements
        this.uploadProgress = document.getElementById('upload-progress');
        this.processingDashboard = document.getElementById('processing-dashboard');
        this.downloadCenter = document.getElementById('download-center');
        
        // Debug elements
        console.log('=== Element Check ===');
        console.log('Settings panel:', this.settingsPanel);
        console.log('Settings toggle:', this.settingsToggle);
        console.log('Settings close:', this.settingsClose);
        
        // Create settings overlay
        this.settingsOverlay = document.createElement('div');
        this.settingsOverlay.className = 'settings-overlay';
        document.body.appendChild(this.settingsOverlay);
        
        // Check if critical elements are missing
        if (!this.settingsPanel) {
            console.error('❌ Settings panel not found in DOM');
        }
        if (!this.settingsToggle) {
            console.error('❌ Settings toggle button not found in DOM');
        }
    }

    bindEvents() {
        // Upload events
        if (this.browseBtn) {
            this.browseBtn.addEventListener('click', () => this.fileInput.click());
        }
        if (this.cameraBtn) {
            this.cameraBtn.addEventListener('click', () => this.cameraInput.click());
        }
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        if (this.cameraInput) {
            this.cameraInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        
        // Drag and drop events
        if (this.uploadZone) {
            this.uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
            this.uploadZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
            this.uploadZone.addEventListener('drop', this.handleDrop.bind(this));
            this.uploadZone.addEventListener('click', () => this.fileInput?.click());
        }
        
        // Settings events with debugging
        if (this.settingsToggle) {
            console.log('✅ Binding settings toggle event');
            this.settingsToggle.addEventListener('click', (e) => {
                console.log('Settings toggle clicked');
                e.preventDefault();
                this.openSettings();
            });
        } else {
            console.error('❌ Cannot bind settings toggle - element not found');
        }
        
        if (this.settingsClose) {
            console.log('✅ Binding settings close event');
            this.settingsClose.addEventListener('click', (e) => {
                console.log('Settings close clicked');
                e.preventDefault();
                this.closeSettings();
            });
        }
        
        if (this.settingsOverlay) {
            this.settingsOverlay.addEventListener('click', () => this.closeSettings());
        }
        
        // Clear all
        if (this.clearAllBtn) {
            this.clearAllBtn.addEventListener('click', () => this.clearAllImages());
        }
        
        // Settings form events
        this.bindSettingsEvents();
        
        // Prevent default drag behavior on document
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }

    bindSettingsEvents() {
        // Format selection
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.settings.format = btn.dataset.format;
                this.updateQualitySlider();
                this.saveSettings();
            });
        });

        // Quality slider
        const qualitySlider = document.getElementById('quality-slider');
        const qualityValue = document.getElementById('quality-value');
        if (qualitySlider) {
            qualitySlider.addEventListener('input', (e) => {
                qualityValue.textContent = e.target.value;
                this.settings.quality = parseInt(e.target.value);
                this.updateSizeEstimate();
                this.saveSettings();
            });
        }

        // Resize presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (btn.dataset.custom) {
                    document.getElementById('custom-dimensions').classList.remove('hidden');
                    this.settings.resize.custom = true;
                } else {
                    document.getElementById('custom-dimensions').classList.add('hidden');
                    this.settings.resize.width = parseInt(btn.dataset.width);
                    this.settings.resize.height = parseInt(btn.dataset.height);
                    this.settings.resize.custom = false;
                }
                this.saveSettings();
            });
        });

        // Custom dimensions
        const customWidth = document.getElementById('custom-width');
        const customHeight = document.getElementById('custom-height');
        const aspectLock = document.getElementById('aspect-lock');
        
        if (customWidth && customHeight && aspectLock) {
            let aspectRatio = 16/9; // Default aspect ratio
            
            customWidth.addEventListener('input', (e) => {
                if (aspectLock.classList.contains('active')) {
                    customHeight.value = Math.round(e.target.value / aspectRatio);
                }
                this.settings.resize.width = parseInt(e.target.value) || 1920;
                this.settings.resize.height = parseInt(customHeight.value) || 1080;
                this.saveSettings();
            });
            
            customHeight.addEventListener('input', (e) => {
                if (aspectLock.classList.contains('active')) {
                    customWidth.value = Math.round(e.target.value * aspectRatio);
                }
                this.settings.resize.width = parseInt(customWidth.value) || 1920;
                this.settings.resize.height = parseInt(e.target.value) || 1080;
                this.saveSettings();
            });
            
            aspectLock.addEventListener('click', () => {
                aspectLock.classList.toggle('active');
                if (aspectLock.classList.contains('active')) {
                    aspectRatio = (parseInt(customWidth.value) || 1920) / (parseInt(customHeight.value) || 1080);
                }
            });
        }

        // Watermark tabs
        document.querySelectorAll('.watermark-type-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.watermark-type-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.settings.watermark.type = btn.dataset.type;
                this.updateWatermarkUI();
                this.saveSettings();
            });
        });

        // Watermark text input
        const watermarkText = document.getElementById('watermark-text');
        if (watermarkText) {
            watermarkText.addEventListener('input', (e) => {
                this.settings.watermark.text = e.target.value;
                this.saveSettings();
            });
        }

        // Watermark font
        const watermarkFont = document.getElementById('watermark-font');
        if (watermarkFont) {
            watermarkFont.addEventListener('change', (e) => {
                this.settings.watermark.font = e.target.value;
                this.saveSettings();
            });
        }

        // Position buttons
        document.querySelectorAll('.position-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.position-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.settings.watermark.position = btn.dataset.position;
                this.saveSettings();
            });
        });

        // Opacity slider
        const opacitySlider = document.getElementById('opacity-slider');
        const opacityValue = document.getElementById('opacity-value');
        if (opacitySlider && opacityValue) {
            opacitySlider.addEventListener('input', (e) => {
                opacityValue.textContent = e.target.value;
                this.settings.watermark.opacity = parseInt(e.target.value) / 100;
                this.saveSettings();
            });
        }

        // Naming tabs
        document.querySelectorAll('.naming-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.naming-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                this.settings.naming.type = btn.dataset.naming;
                this.updateNamingUI();
                this.saveSettings();
            });
        });

        // Custom naming inputs
        const namingPrefix = document.getElementById('naming-prefix');
        const namingStart = document.getElementById('naming-start');
        
        if (namingPrefix) {
            namingPrefix.addEventListener('input', (e) => {
                this.settings.naming.prefix = e.target.value;
                this.updateNamingPreview();
                this.saveSettings();
            });
        }
        
        if (namingStart) {
            namingStart.addEventListener('input', (e) => {
                this.settings.naming.start = parseInt(e.target.value) || 1;
                this.updateNamingPreview();
                this.saveSettings();
            });
        }

        // Settings actions
        const resetBtn = document.getElementById('reset-settings');
        const saveBtn = document.getElementById('save-settings');
        
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetSettings());
        if (saveBtn) saveBtn.addEventListener('click', () => this.closeSettings());
    }

    setupWatermarkListeners() {
        console.log('🔧 Setting up watermark upload listeners...');

        const watermarkUploadBtn = document.getElementById('watermark-upload-btn');
        const watermarkInput = document.getElementById('watermark-input');
        const watermarkPreview = document.getElementById('watermark-preview');
        const watermarkImage = document.getElementById('watermark-image');
        const removeWatermarkBtn = document.getElementById('remove-watermark');

        console.log('🔍 Watermark elements check:', {
            uploadBtn: !!watermarkUploadBtn,
            input: !!watermarkInput,
            preview: !!watermarkPreview,
            image: !!watermarkImage,
            removeBtn: !!removeWatermarkBtn
        });

        if (watermarkUploadBtn && watermarkInput) {
            console.log('✅ Adding watermark upload listeners');
            
            watermarkUploadBtn.addEventListener('click', (e) => {
                console.log('🖱️ Watermark upload button clicked!');
                e.preventDefault();
                e.stopPropagation();
                watermarkInput.click();
            });
            
            watermarkInput.addEventListener('change', async (e) => {
                console.log('📁 File input changed, files:', e.target.files.length);
                const file = e.target.files[0];
                
                if (file && file.type.startsWith('image/')) {
                    console.log('🖼️ Valid image selected:', file.name, file.type);
                    try {
                        // Show preview immediately
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            console.log('📸 Showing preview');
                            if (watermarkImage && watermarkPreview) {
                                watermarkImage.src = event.target.result;
                                watermarkPreview.classList.remove('hidden');
                            }
                        };
                        reader.readAsDataURL(file);
                        
                        // Upload to server
                        console.log('📤 Starting upload to server...');
                        const formData = new FormData();
                        formData.append('watermark', file);
                        
                        const response = await fetch('/api/upload/watermark', {
                            method: 'POST',
                            body: formData
                        });
                        
                        console.log('📥 Server response status:', response.status);
                        
                        if (response.ok) {
                            const result = await response.json();
                            console.log('✅ Upload successful:', result);
                            this.settings.watermark.imagePath = result.watermark.path;
                            this.settings.watermark.imageUrl = result.watermark.path;
                            this.saveSettings();
                            this.showToast('Watermark uploaded successfully!', 'success');
                        } else {
                            const errorData = await response.json().catch(() => ({}));
                            console.error('❌ Upload failed:', errorData);
                            throw new Error(errorData.message || 'Upload failed');
                        }
                        
                    } catch (error) {
                        console.error('❌ Watermark upload error:', error);
                        this.showToast('Failed to upload watermark: ' + error.message, 'error');
                    }
                } else {
                    console.log('⚠️ Invalid file selected');
                    this.showToast('Please select a valid image file', 'warning');
                }
                
                // Reset input
                e.target.value = '';
            });
        } else {
            console.error('❌ Watermark upload elements not found!');
        }

        if (removeWatermarkBtn) {
            removeWatermarkBtn.addEventListener('click', (e) => {
                console.log('🗑️ Remove watermark clicked');
                e.preventDefault();
                if (watermarkPreview && watermarkImage) {
                    watermarkPreview.classList.add('hidden');
                    watermarkImage.src = '';
                }
                this.settings.watermark.imagePath = null;
                this.settings.watermark.imageUrl = null;
                this.saveSettings();
                this.showToast('Watermark removed', 'success');
            });
        }
    }

    // File handling methods
    handleDragOver(e) {
        e.preventDefault();
        this.uploadZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        if (!this.uploadZone.contains(e.relatedTarget)) {
            this.uploadZone.classList.remove('drag-over');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadZone.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
        e.target.value = ''; // Reset input
    }

    processFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.showToast('No valid image files selected', 'warning');
            return;
        }

        if (this.uploadedImages.length + imageFiles.length > 100) {
            this.showToast('Maximum 100 images allowed', 'error');
            return;
        }

        this.showUploadProgress();
        
        // Process files in chunks to avoid blocking UI
        this.processFilesInChunks(imageFiles);
    }

    async processFilesInChunks(files) {
        const chunkSize = 5;
        let processed = 0;
        
        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            
            await Promise.all(chunk.map(async (file) => {
                try {
                    const imageData = await this.createImageData(file);
                    this.uploadedImages.push(imageData);
                    this.addImageToGrid(imageData);
                    
                    processed++;
                    this.updateUploadProgress(processed, files.length);
                } catch (error) {
                    console.error('Error processing file:', file.name, error);
                    this.showToast(`Error processing ${file.name}`, 'error');
                }
            }));
            
            // Small delay to keep UI responsive
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        this.hideUploadProgress();
        this.updateUI();
        
        if (processed > 0) {
            this.showToast(`Added ${processed} images`, 'success');
        }
    }

    async createImageData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Create thumbnail
                    const maxSize = 200;
                    const ratio = Math.min(maxSize / img.width, maxSize / img.height);
                    canvas.width = img.width * ratio;
                    canvas.height = img.height * ratio;
                    
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    
                    resolve({
                        id: Date.now() + Math.random(),
                        file: file,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        width: img.width,
                        height: img.height,
                        thumbnail: canvas.toDataURL('image/jpeg', 0.8),
                        processed: false
                    });
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    addImageToGrid(imageData) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.id = imageData.id;
        
        card.innerHTML = `
            <img src="${imageData.thumbnail}" alt="${imageData.name}" class="image-preview">
            <div class="image-info">
                <div class="image-name">${imageData.name}</div>
                <div class="image-meta">
                    <span>${imageData.width}×${imageData.height}</span>
                    <span>${this.formatFileSize(imageData.size)}</span>
                </div>
            </div>
            <div class="image-actions">
                <button class="btn btn-small btn-danger remove-image-btn" data-image-id="${imageData.id}">
                    <svg class="icon" viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                    Remove
                </button>
            </div>
        `;
        
        // Add event listener to remove button (no inline handlers)
        const removeBtn = card.querySelector('.remove-image-btn');
        removeBtn.addEventListener('click', () => {
            this.removeImage(imageData.id);
        });
        
        this.imageGrid.appendChild(card);
    }

    removeImage(id) {
        this.uploadedImages = this.uploadedImages.filter(img => img.id !== id);
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
            card.remove();
        }
        this.updateUI();
    }

    clearAllImages() {
        if (this.uploadedImages.length === 0) return;
        
        if (confirm('Remove all images?')) {
            this.uploadedImages = [];
            this.imageGrid.innerHTML = '';
            this.updateUI();
            this.showToast('All images removed', 'success');
        }
    }

    updateUI() {
        const hasImages = this.uploadedImages.length > 0;
        
        this.imageGrid.classList.toggle('hidden', !hasImages);
        this.clearAllBtn.classList.toggle('hidden', !hasImages);
        this.uploadZone.style.display = hasImages ? 'none' : 'block';
        
        // Show process button if images are uploaded
        if (hasImages && !document.getElementById('process-btn')) {
            this.addProcessButton();
        } else if (!hasImages) {
            const processBtn = document.getElementById('process-btn');
            if (processBtn) processBtn.remove();
        }
    }

    addProcessButton() {
        const button = document.createElement('button');
        button.id = 'process-btn';
        button.className = 'btn btn-primary btn-large';
        button.style.cssText = 'width: 100%; margin-top: 1rem;';
        button.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            Process ${this.uploadedImages.length} Images
        `;
        button.addEventListener('click', () => this.startProcessing());
        
        this.imageGrid.after(button);
    }

    debugSettingsPanel() {
        console.log('=== Settings Panel Debug ===');
        const panel = document.getElementById('settings-panel');
        const toggle = document.getElementById('settings-toggle');
        const overlay = this.settingsOverlay;
        
        console.log('Panel element:', panel);
        console.log('Toggle element:', toggle);
        console.log('Overlay element:', overlay);
        
        if (panel) {
            console.log('Panel classes:', panel.className);
            console.log('Panel computed style:', {
                display: window.getComputedStyle(panel).display,
                position: window.getComputedStyle(panel).position,
                right: window.getComputedStyle(panel).right,
                zIndex: window.getComputedStyle(panel).zIndex,
                visibility: window.getComputedStyle(panel).visibility
            });
        }
        
        // Test opening manually
        if (panel) {
            console.log('Testing manual open...');
            panel.classList.add('open');
            if (overlay) overlay.classList.add('active');
            
            setTimeout(() => {
                console.log('Panel after manual open:', {
                    hasOpenClass: panel.classList.contains('open'),
                    computedRight: window.getComputedStyle(panel).right
                });
            }, 100);
        }
    }

    openSettings() {
        console.log('🔧 Opening settings...');

        if (!this.settingsPanel) {
            console.error('❌ Settings panel not found');
            return;
        }

        // Fix: Ensure the panel is visible
        this.settingsPanel.classList.remove('hidden');
        this.settingsPanel.classList.add('open');

        if (this.settingsOverlay) {
            this.settingsOverlay.classList.add('active');
        }

        document.body.style.overflow = 'hidden';

        console.log('📱 After open - Panel classes:', this.settingsPanel.className);
        
        // Ensure watermark listeners are set up when settings open
        setTimeout(() => {
            this.setupWatermarkListeners();
        }, 100);
    }

    closeSettings() {
        if (this.settingsPanel) {
            this.settingsPanel.classList.remove('open');
            this.settingsPanel.classList.add('hidden');
        }
        if (this.settingsOverlay) {
            this.settingsOverlay.classList.remove('active');
        }
        document.body.style.overflow = '';
    }

    loadSettings() {
        const defaultSettings = {
            format: 'webp',
            quality: 85,
            resize: {
                width: 1920,
                height: 1080,
                custom: false,
                fit: 'inside'
            },
            watermark: {
                type: 'none',
                text: 'Watermark',
                font: 'Arial',
                position: 'southeast',
                opacity: 0.7,
                imagePath: null,
                imageUrl: null
            },
            naming: {
                type: 'original',
                prefix: 'image',
                start: 1
            }
        };

        const saved = localStorage.getItem('imageConverterSettings');
        return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    }

    saveSettings() {
        localStorage.setItem('imageConverterSettings', JSON.stringify(this.settings));
    }

    resetSettings() {
        if (confirm('Reset all settings to default?')) {
            localStorage.removeItem('imageConverterSettings');
            this.settings = this.loadSettings();
            this.updateSettingsUI();
            this.showToast('Settings reset to default', 'success');
        }
    }

    updateSettingsUI() {
        // Update format selection
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.format === this.settings.format);
        });

        // Update quality slider
        const qualitySlider = document.getElementById('quality-slider');
        const qualityValue = document.getElementById('quality-value');
        if (qualitySlider && qualityValue) {
            qualitySlider.value = this.settings.quality;
            qualityValue.textContent = this.settings.quality;
        }

        // Update resize presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            const isCustom = btn.dataset.custom === 'true';
            const isActive = isCustom ? this.settings.resize.custom : 
                (parseInt(btn.dataset.width) === this.settings.resize.width && 
                 parseInt(btn.dataset.height) === this.settings.resize.height);
            btn.classList.toggle('active', isActive);
        });

        // Update custom dimensions
        const customWidth = document.getElementById('custom-width');
        const customHeight = document.getElementById('custom-height');
        const customDimensions = document.getElementById('custom-dimensions');
        
        if (customWidth) customWidth.value = this.settings.resize.width;
        if (customHeight) customHeight.value = this.settings.resize.height;
        if (customDimensions) customDimensions.classList.toggle('hidden', !this.settings.resize.custom);

        // Update watermark
        document.querySelectorAll('.watermark-type-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === this.settings.watermark.type);
        });
        
        this.updateWatermarkUI();
        this.updateNamingUI();
        this.updateQualitySlider();
        this.updateSizeEstimate();
    }

    updateWatermarkUI() {
        const type = this.settings.watermark.type;
        
        const textWatermark = document.getElementById('text-watermark');
        const imageWatermark = document.getElementById('image-watermark');
        const watermarkControls = document.getElementById('watermark-controls');
        
        if (textWatermark) textWatermark.classList.toggle('hidden', type !== 'text');
        if (imageWatermark) imageWatermark.classList.toggle('hidden', type !== 'image');
        if (watermarkControls) watermarkControls.classList.toggle('hidden', type === 'none');
        
        if (type === 'text') {
            const watermarkText = document.getElementById('watermark-text');
            const watermarkFont = document.getElementById('watermark-font');
            if (watermarkText) watermarkText.value = this.settings.watermark.text;
            if (watermarkFont) watermarkFont.value = this.settings.watermark.font;
        }
        
        // Handle image watermark preview
        if (type === 'image') {
            const watermarkPreview = document.getElementById('watermark-preview');
            const watermarkImage = document.getElementById('watermark-image');
            
            if (this.settings.watermark.imageUrl && watermarkImage) {
                watermarkImage.src = this.settings.watermark.imageUrl;
                if (watermarkPreview) watermarkPreview.classList.remove('hidden');
            }
        }
        
        // Update position
        document.querySelectorAll('.position-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.position === this.settings.watermark.position);
        });
        
        // Update opacity
        const opacitySlider = document.getElementById('opacity-slider');
        const opacityValue = document.getElementById('opacity-value');
        if (opacitySlider && opacityValue) {
            const opacity = Math.round(this.settings.watermark.opacity * 100);
            opacitySlider.value = opacity;
            opacityValue.textContent = opacity;
        }
    }

    updateNamingUI() {
        const type = this.settings.naming.type;
        
        document.querySelectorAll('.naming-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.naming === type);
        });
        
        const customNaming = document.getElementById('custom-naming');
        if (customNaming) {
            customNaming.classList.toggle('hidden', type !== 'custom' && type !== 'numbered');
        }
        
        if (type === 'custom' || type === 'numbered') {
            const namingPrefix = document.getElementById('naming-prefix');
            const namingStart = document.getElementById('naming-start');
            if (namingPrefix) namingPrefix.value = this.settings.naming.prefix;
            if (namingStart) namingStart.value = this.settings.naming.start;
            this.updateNamingPreview();
        }
    }

    updateNamingPreview() {
const preview = document.getElementById('naming-preview-text');
       const type = this.settings.naming.type;
       
       if (preview && (type === 'custom' || type === 'numbered')) {
           const number = String(this.settings.naming.start).padStart(3, '0');
           const extension = this.getFileExtension();
           preview.textContent = `${this.settings.naming.prefix}${number}.${extension}`;
       }
   }

   updateQualitySlider() {
       const format = this.settings.format;
       const qualitySlider = document.getElementById('quality-slider');
       const qualityLabel = qualitySlider?.previousElementSibling;
       
       if (qualitySlider && qualityLabel) {
           if (format === 'png') {
               qualitySlider.style.display = 'none';
               qualityLabel.style.display = 'none';
           } else {
               qualitySlider.style.display = 'block';
               qualityLabel.style.display = 'block';
           }
       }
   }

   updateSizeEstimate() {
       const quality = this.settings.quality;
       const format = this.settings.format;
       let reduction;
       
       switch (format) {
           case 'webp':
               reduction = Math.round(75 - (quality * 0.3));
               break;
           case 'jpeg':
               reduction = Math.round(60 - (quality * 0.4));
               break;
           case 'avif':
               reduction = Math.round(80 - (quality * 0.2));
               break;
           default:
               reduction = 0;
       }
       
       const estimate = document.getElementById('size-estimate');
       if (estimate) {
           estimate.textContent = reduction > 0 ? `~${reduction}% smaller` : 'Lossless';
       }
   }

   // Processing methods
   async startProcessing() {
       if (this.processing || this.uploadedImages.length === 0) return;
       
       this.processing = true;
       this.showProcessingDashboard();
       
       const processBtn = document.getElementById('process-btn');
       const cancelBtn = document.getElementById('cancel-job');
       
       if (processBtn) {
           processBtn.disabled = true;
           processBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px;"></div> Starting...';
       }
       
       // Set up cancel button
       if (cancelBtn) {
           cancelBtn.onclick = () => this.cancelProcessing();
           cancelBtn.disabled = false;
       }
       
       try {
           // Create FormData with files and settings
           const formData = new FormData();
           
           // Add all uploaded files
           this.uploadedImages.forEach((imageData) => {
               formData.append('images', imageData.file);
           });
           
           // Add processing settings
           formData.append('settings', JSON.stringify(this.settings));
           
           // Start job using job manager
           const jobId = await window.jobManager.startJob(formData);
           console.log('Processing started with job ID:', jobId);
           
           // Start polling for progress
           await this.pollJobProgress(jobId);
           
       } catch (error) {
           console.error('Processing error:', error);
           this.showToast(`Processing failed: ${error.message}`, 'error');
           this.hideProcessingDashboard();
           this.resetProcessButton();
       } finally {
           this.processing = false;
       }
   }

   async cancelProcessing() {
       if (!window.jobManager) return;
       
       const cancelBtn = document.getElementById('cancel-job');
       if (cancelBtn) {
           cancelBtn.disabled = true;
           cancelBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px;"></div> Cancelling...';
       }
       
       await window.jobManager.cancelCurrentJob();
       this.processing = false;
   }

   async pollJobProgress(jobId) {
       const pollInterval = 5000;
       let completed = false;
       let consecutiveErrors = 0;
       const maxConsecutiveErrors = 3;
       
       console.log(`🔄 Starting polling for job ${jobId}`);
       
       while (!completed && this.processing && !window.jobManager.isCancelRequested()) {
           try {
               const jobData = await window.jobManager.getJobStatus(jobId);
               console.log(`📊 Polling job ${jobId}:`, jobData.status, jobData.progress?.percentage + '%');
               
               consecutiveErrors = 0;
               this.updateProgressDisplay(jobData);
               
               switch (jobData.status) {
                   case 'completed':
                       console.log('✅ Job completed!');
                       completed = true;
                       await this.handleProcessingComplete(jobData);
                       break;
                       
                   case 'failed':
                       console.log('❌ Job failed!');
                       completed = true;
                       this.handleProcessingFailed(jobData);
                       break;
                       
                   case 'cancelled':
                       console.log('⚠️ Job cancelled!');
                       completed = true;
                       this.handleProcessingCancelled(jobData);
                       break;
                       
                   case 'processing':
                       console.log(`⏳ Processing: ${jobData.progress?.percentage || 0}%`);
                       break;
               }
               
           } catch (error) {
               consecutiveErrors++;
               console.error('Polling error:', error);
               
               if (consecutiveErrors >= maxConsecutiveErrors) {
                   this.showToast(`Error checking progress: ${error.message}`, 'error');
                   completed = true;
                   this.hideProcessingDashboard();
                   this.resetProcessButton();
                   break;
               }
           }
           
           if (!completed) {
               await new Promise(resolve => setTimeout(resolve, pollInterval));
           }
       }
       
       window.jobManager.clearCurrentJob();
       this.processing = false;
       console.log('🏁 Polling completed for job:', jobId);
   }

   updateProgressDisplay(jobData) {
       const { progress } = jobData;
       
       console.log('📊 Updating progress display:', progress);
       
       // Update progress ring
       const progressBar = document.getElementById('progress-bar');
       if (progressBar && progress) {
           const circumference = 2 * Math.PI * 54;
           const offset = circumference - (progress.percentage / 100) * circumference;
           progressBar.style.strokeDashoffset = offset;
       }
       
       // Update percentage text
       const progressPercentage = document.getElementById('progress-percentage');
       if (progressPercentage) {
           progressPercentage.textContent = `${progress.percentage || 0}%`;
       }
       
       // Update processed count
       const processedCount = document.getElementById('processed-count');
       if (processedCount) {
           processedCount.textContent = `${progress.processed || 0} / ${progress.total || 0}`;
       }
       
       // Update speed
       const processingSpeed = document.getElementById('processing-speed');
       if (processingSpeed && progress.speed) {
           processingSpeed.textContent = `${progress.speed.toFixed(1)} img/s`;
       }
       
       // Update ETA
       const timeRemaining = document.getElementById('time-remaining');
       if (timeRemaining && progress.eta) {
           const minutes = Math.floor(progress.eta / 60);
           const seconds = Math.floor(progress.eta % 60);
           timeRemaining.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
       }
   }

   async handleProcessingComplete(jobData) {
       console.log('✅ Processing completed:', jobData);
       
       this.hideProcessingDashboard();
       this.showDownloadCenter(jobData);
       this.resetProcessButton();
       
       const message = jobData.failedCount > 0 
           ? `Processed ${jobData.successCount} images (${jobData.failedCount} failed)`
           : `Successfully processed ${jobData.successCount} images!`;
       
       this.showToast(message, jobData.failedCount > 0 ? 'warning' : 'success');
       
       const downloadBtn = document.getElementById('download-zip');
       if (downloadBtn && jobData.downloadUrl) {
           downloadBtn.onclick = () => this.downloadResults(jobData.downloadUrl);
           downloadBtn.disabled = false;
           downloadBtn.style.display = 'block';
       }
       
       if (jobData.summary) {
           this.showCompressionStats(jobData.summary);
       }
       
       this.processing = false;
   }

   handleProcessingFailed(jobData) {
       this.hideProcessingDashboard();
       this.resetProcessButton();
       
       const errorMessage = jobData.error || 'Processing failed for unknown reason';
       this.showToast(`Processing failed: ${errorMessage}`, 'error');
       
       this.showRetryOption(jobData.jobId);
   }

   handleProcessingCancelled(jobData) {
       this.hideProcessingDashboard();
       this.resetProcessButton();
       this.showToast('Processing was cancelled', 'warning');
   }

   showRetryOption(jobId) {
       const retryDiv = document.createElement('div');
       retryDiv.className = 'retry-option';
       retryDiv.innerHTML = `
           <div class="retry-message">
           <p>Processing failed. Would you like to try again?</p>
              <div class="retry-actions">
                  <button id="retry-job" class="btn btn-primary">
                      <svg class="icon" viewBox="0 0 24 24">
                          <path d="M1 4v6h6M23 20v-6h-6"/>
                          <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
                      </svg>
                      Retry Processing
                  </button>
                  <button id="dismiss-retry" class="btn btn-secondary">Dismiss</button>
              </div>
          </div>
      `;
      
      document.querySelector('.main-container').appendChild(retryDiv);
      
      document.getElementById('retry-job').onclick = async () => {
          try {
              retryDiv.remove();
              this.processing = true;
              this.showProcessingDashboard();
              
              const newJobId = await window.jobManager.retryJob(jobId);
              await this.pollJobProgress(newJobId);
              
          } catch (error) {
              this.showToast(`Retry failed: ${error.message}`, 'error');
              this.hideProcessingDashboard();
              this.resetProcessButton();
          }
      };
      
      document.getElementById('dismiss-retry').onclick = () => {
          retryDiv.remove();
      };
      
      setTimeout(() => {
          if (document.contains(retryDiv)) {
              retryDiv.remove();
          }
      }, 30000);
  }

  showCompressionStats(summary) {
      const downloadCenter = document.getElementById('download-center');
      const existingStats = downloadCenter.querySelector('.compression-stats');
      
      if (existingStats) {
          existingStats.remove();
      }
      
      const statsDiv = document.createElement('div');
      statsDiv.className = 'compression-stats';
      statsDiv.innerHTML = `
          <div class="stats-grid">
              <div class="stat-item">
                  <span class="stat-label">Original Size</span>
                  <span class="stat-value">${this.formatFileSize(summary.totalSize)}</span>
              </div>
              <div class="stat-item">
                  <span class="stat-label">Compressed Size</span>
                  <span class="stat-value">${this.formatFileSize(summary.processedSize)}</span>
              </div>
              <div class="stat-item">
                  <span class="stat-label">Space Saved</span>
                  <span class="stat-value success">${summary.compressionRatio}%</span>
              </div>
          </div>
      `;
      
      const downloadSummary = downloadCenter.querySelector('.download-summary');
      if (downloadSummary) {
          downloadSummary.appendChild(statsDiv);
      }
  }

   resetProcessButton() {
       const processBtn = document.getElementById('process-btn');
       if (processBtn) {
           processBtn.disabled = false;
           processBtn.style.display = 'block';
           processBtn.innerHTML = `
               <svg class="icon" viewBox="0 0 24 24">
                   <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
               </svg>
               Process ${this.uploadedImages.length} Images
           `;
       }
   }

   downloadResults(downloadUrl) {
       const link = document.createElement('a');
       link.href = downloadUrl;
       link.style.display = 'none';
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       
       this.showToast('Download started!', 'success');
   }

   showProcessingDashboard() {
       console.log('📊 Showing processing dashboard');
       
       if (this.processingDashboard) {
           this.processingDashboard.classList.remove('hidden');
       }
       
       if (this.imageGrid) {
           this.imageGrid.style.display = 'none';
       }
       
       const processBtn = document.getElementById('process-btn');
       if (processBtn) {
           processBtn.style.display = 'none';
       }
       
       const progressBar = document.getElementById('progress-bar');
       if (progressBar) {
           progressBar.style.strokeDashoffset = '339.292';
       }
       
       const progressPercentage = document.getElementById('progress-percentage');
       if (progressPercentage) {
           progressPercentage.textContent = '0%';
       }
   }

   hideProcessingDashboard() {
       this.processingDashboard.classList.add('hidden');
       this.imageGrid.style.display = 'grid';
       const processBtn = document.getElementById('process-btn');
       if (processBtn) processBtn.style.display = 'block';
   }

   showDownloadCenter(data) {
       if (this.downloadCenter) {
           this.downloadCenter.classList.remove('hidden');
           this.downloadCenter.style.display = 'block';
       }
       
       const successCount = document.getElementById('success-count');
       if (successCount) {
           successCount.textContent = data.successCount || this.uploadedImages.length;
       }
       
       if (this.processingDashboard) {
           this.processingDashboard.classList.add('hidden');
           this.processingDashboard.style.display = 'none';
       }
       
       if (this.imageGrid) {
           this.imageGrid.style.display = 'none';
       }
   }

   formatFileSize(bytes) {
       if (bytes === 0) return '0 Bytes';
       const k = 1024;
       const sizes = ['Bytes', 'KB', 'MB', 'GB'];
       const i = Math.floor(Math.log(bytes) / Math.log(k));
       return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
   }

   getFileExtension() {
       const formatMap = {
           'webp': 'webp',
           'jpeg': 'jpg',
           'png': 'png',
           'avif': 'avif'
       };
       return formatMap[this.settings.format] || 'webp';
   }

   showUploadProgress() {
       if (this.uploadProgress) {
           this.uploadProgress.classList.remove('hidden');
       }
   }

   hideUploadProgress() {
       if (this.uploadProgress) {
           this.uploadProgress.classList.add('hidden');
       }
   }

   updateUploadProgress(current, total) {
       const percentage = Math.round((current / total) * 100);
       const fill = document.getElementById('upload-progress-fill');
       const text = document.getElementById('upload-status-text');
       const percent = document.getElementById('upload-percentage');
       
       if (fill) fill.style.width = `${percentage}%`;
       if (text) text.textContent = `Processing ${current} of ${total} files...`;
       if (percent) percent.textContent = `${percentage}%`;
   }

   showToast(message, type = 'info', duration = 4000) {
       const container = document.getElementById('toast-container');
       if (!container) return;
       
       const toast = document.createElement('div');
       toast.className = `toast ${type}`;
       
       const iconMap = {
           success: '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
           error: '<path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
           warning: '<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>',
           info: '<path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
       };
       
       toast.innerHTML = `
           <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
               ${iconMap[type] || iconMap.info}
           </svg>
           <div class="toast-content">
               <div class="toast-message">${message}</div>
           </div>
           <button class="toast-close">×</button>
       `;
       
       toast.querySelector('.toast-close').addEventListener('click', () => {
           toast.remove();
       });
       
       container.appendChild(toast);
       
       setTimeout(() => {
           if (toast.parentNode) {
               toast.style.animation = 'slideOut 0.3s ease forwards';
               setTimeout(() => toast.remove(), 300);
           }
       }, duration);
   }
}

// Job Manager Class
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
               if (response.status === 429) {
                   throw new Error('Rate limited - please wait');
               }
               const errorData = await response.json().catch(() => ({}));
               throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
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

// Add CSS animation for toast slide out
const style = document.createElement('style');
style.textContent = `
   @keyframes slideOut {
       to {
           transform: translateX(100%);
           opacity: 0;
       }
   }
`;
document.head.appendChild(style);

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
   window.app = new ImageConverter();
   window.jobManager = new JobManager(window.app);
});

// Mobile optimizations
if ('serviceWorker' in navigator) {
   window.addEventListener('load', () => {
       // Register service worker for offline functionality (optional)
       // navigator.serviceWorker.register('/sw.js');
   });
}

// Handle mobile viewport
function setMobileViewport() {
   const viewport = document.querySelector('meta[name="viewport"]');
   if (viewport && window.innerWidth <= 768) {
       viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
   }
}

setMobileViewport();
window.addEventListener('orientationchange', setMobileViewport);

// Error handling for global errors
window.addEventListener('error', (event) => {
   console.error('Global error:', event.error);
   if (window.app) {
       window.app.showToast('An unexpected error occurred', 'error');
   }
});

window.addEventListener('unhandledrejection', (event) => {
   console.error('Unhandled promise rejection:', event.reason);
   if (window.app) {
       window.app.showToast('An unexpected error occurred', 'error');
   }
});