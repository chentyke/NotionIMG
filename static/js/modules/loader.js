// Enhanced Loading progress and status indicators with multi-stage animations

// Loading stages configuration
const loadingStages = [
    { name: 'init', text: '初始化页面环境...', statusKey: 'init' },
    { name: 'fetch', text: '获取页面数据...', statusKey: 'fetch' },
    { name: 'render', text: '渲染页面内容...', statusKey: 'render' },
    { name: 'process', text: '处理页面元素...', statusKey: 'process' },
    { name: 'complete', text: '完成加载...', statusKey: 'complete' }
];

let currentStage = 0;
let isLoadingComplete = false;

/**
 * Updates the loading progress bar with enhanced animations and stage indicators
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingProgress(progress) {
    const progressBar = document.getElementById('loadingProgressBar');
    const loadingProgress = document.getElementById('loadingProgress');
    if (!progressBar) return;
    
    // Ensure progress is between 0 and 100
    const safeProgress = Math.max(0, Math.min(100, progress));
    
    // Update stage based on progress
    updateLoadingStage(safeProgress);
    
    // Add easing to progress bar updates
    const currentWidth = parseFloat(progressBar.style.width || '0');
    const targetWidth = safeProgress;
    
    // Animate the progress bar with easing
    animateProgressBar(currentWidth, targetWidth);
    
    // Update loading text based on progress and stage
    updateLoadingText(safeProgress);
    
    // Update status indicators
    updateStatusIndicators(safeProgress);
    
    if (safeProgress >= 100 && !isLoadingComplete) {
        isLoadingComplete = true;
        setTimeout(() => {
            // Mark progress as complete
            loadingProgress?.classList.add('complete');
            
            // Complete all stages
            completeAllStages();
            
            // Fade out loading overlay with enhanced animation
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('fade-out');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    loadingOverlay.classList.remove('fade-out');
                    // Reset for next use
                    resetLoadingState();
                }, 600);
            }
        }, 500);
    }
}

/**
 * Updates the current loading stage based on progress
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingStage(progress) {
    const stageThresholds = [0, 20, 50, 80, 95];
    const newStage = stageThresholds.findIndex((threshold, index) => {
        return index === stageThresholds.length - 1 || progress < stageThresholds[index + 1];
    });
    
    if (newStage !== currentStage && newStage >= 0) {
        // Update stage dots
        updateStageDots(newStage);
        currentStage = newStage;
    }
}

/**
 * Updates the stage dots visual indicators
 * @param {number} activeStage - The currently active stage index
 */
function updateStageDots(activeStage) {
    const stageDots = document.querySelectorAll('.stage-dot');
    
    stageDots.forEach((dot, index) => {
        dot.classList.remove('active', 'completed');
        
        if (index < activeStage) {
            dot.classList.add('completed');
        } else if (index === activeStage) {
            dot.classList.add('active');
        }
    });
}

/**
 * Updates status indicators based on current progress
 * @param {number} progress - Progress percentage (0-100)
 */
function updateStatusIndicators(progress) {
    const statusItems = document.querySelectorAll('.status-item');
    const stageThresholds = [0, 20, 50, 80, 95];
    
    statusItems.forEach((item, index) => {
        item.classList.remove('active', 'completed');
        
        const threshold = stageThresholds[index];
        const nextThreshold = stageThresholds[index + 1] || 100;
        
        if (progress > nextThreshold) {
            item.classList.add('completed');
        } else if (progress >= threshold) {
            item.classList.add('active');
        }
    });
}

/**
 * Completes all stages with animation
 */
function completeAllStages() {
    const stageDots = document.querySelectorAll('.stage-dot');
    const statusItems = document.querySelectorAll('.status-item');
    
    // Animate completion of all stages
    stageDots.forEach((dot, index) => {
        setTimeout(() => {
            dot.classList.remove('active');
            dot.classList.add('completed');
        }, index * 100);
    });
    
    // Mark all status items as completed
    statusItems.forEach((item, index) => {
        setTimeout(() => {
            item.classList.remove('active');
            item.classList.add('completed');
        }, index * 80);
    });
}

/**
 * Resets the loading state for next use
 */
function resetLoadingState() {
    currentStage = 0;
    isLoadingComplete = false;
    
    // Reset stage dots
    const stageDots = document.querySelectorAll('.stage-dot');
    stageDots.forEach(dot => {
        dot.classList.remove('active', 'completed');
    });
    
    // Reset status items
    const statusItems = document.querySelectorAll('.status-item');
    statusItems.forEach(item => {
        item.classList.remove('active', 'completed');
    });
    
    // Reset progress bar
    const progressBar = document.getElementById('loadingProgressBar');
    if (progressBar) {
        progressBar.style.width = '0%';
    }
    
    // Reset progress container
    const loadingProgress = document.getElementById('loadingProgress');
    if (loadingProgress) {
        loadingProgress.classList.remove('complete');
    }
}

/**
 * Animates the progress bar with enhanced easing
 * @param {number} current - Current width percentage
 * @param {number} target - Target width percentage
 */
function animateProgressBar(current, target) {
    const progressBar = document.getElementById('loadingProgressBar');
    if (!progressBar) return;
    
    // Use requestAnimationFrame for smoother animation
    const duration = 400; // ms
    const startTime = performance.now();
    
    const animate = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Enhanced ease function (ease-out cubic)
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = current + (target - current) * easeProgress;
        
        progressBar.style.width = `${currentValue}%`;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    };
    
    requestAnimationFrame(animate);
}

/**
 * Updates the loading text with enhanced animations
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingText(progress) {
    const loadingText = document.getElementById('loadingText');
    if (!loadingText) return;
    
    let text = '初始化页面...';
    
    if (progress < 20) {
        text = '初始化页面环境...';
    } else if (progress < 50) {
        text = '获取页面数据...';
    } else if (progress < 80) {
        text = '渲染页面内容...';
    } else if (progress < 95) {
        text = '处理页面元素...';
    } else {
        text = '完成加载...';
    }
    
    // Only update if text has changed to avoid disrupting animation
    if (loadingText.textContent !== text) {
        // Add fade effect when changing text
        loadingText.style.opacity = '0.6';
        setTimeout(() => {
            loadingText.textContent = text;
            loadingText.style.opacity = '1';
        }, 150);
    }
}

/**
 * Shows loading overlay with enhanced entrance animation
 */
function showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.opacity = '1';
        loadingOverlay.classList.remove('fade-out');
        
        // Reset loading state
        resetLoadingState();
        
        // Start with first stage
        setTimeout(() => {
            updateLoadingProgress(5);
        }, 100);
    }
}

/**
 * Hides loading overlay
 */
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
            loadingOverlay.classList.remove('fade-out');
            resetLoadingState();
        }, 600);
    }
}

// Export functions
export {
    updateLoadingProgress,
    animateProgressBar,
    updateLoadingText,
    showLoadingOverlay,
    hideLoadingOverlay,
    updateLoadingStage,
    resetLoadingState
}; 