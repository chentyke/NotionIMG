// Loading progress and status indicators

/**
 * Updates the loading progress bar with animation
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingProgress(progress) {
    const progressBar = document.getElementById('loadingProgressBar');
    if (!progressBar) return;
    
    // Ensure progress is between 0 and 100
    const safeProgress = Math.max(0, Math.min(100, progress));
    
    // Add easing to progress bar updates
    const currentWidth = parseFloat(progressBar.style.width || '0');
    const targetWidth = safeProgress;
    
    // Animate the progress bar with easing
    animateProgressBar(currentWidth, targetWidth);
    
    // Update loading text based on progress
    updateLoadingText(safeProgress);
    
    if (safeProgress >= 100) {
        setTimeout(() => {
            document.getElementById('loadingProgress')?.classList.add('complete');
            
            // Fade out loading overlay
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('fade-out');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    loadingOverlay.classList.remove('fade-out');
                }, 500);
            }
        }, 300);
    }
}

/**
 * Animates the progress bar with easing
 * @param {number} current - Current width percentage
 * @param {number} target - Target width percentage
 */
function animateProgressBar(current, target) {
    const progressBar = document.getElementById('loadingProgressBar');
    if (!progressBar) return;
    
    // Use requestAnimationFrame for smoother animation
    const duration = 300; // ms
    const startTime = performance.now();
    const animate = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease function (ease-out)
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
 * Updates the loading text based on progress
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingText(progress) {
    const loadingText = document.querySelector('.loading-text');
    if (!loadingText) return;
    
    if (progress < 20) {
        loadingText.textContent = '正在初始化页面...';
    } else if (progress < 50) {
        loadingText.textContent = '正在获取页面内容...';
    } else if (progress < 80) {
        loadingText.textContent = '正在渲染页面元素...';
    } else if (progress < 95) {
        loadingText.textContent = '优化页面显示...';
    } else {
        loadingText.textContent = '即将完成...';
    }
}

// Export functions
export {
    updateLoadingProgress,
    animateProgressBar,
    updateLoadingText
}; 