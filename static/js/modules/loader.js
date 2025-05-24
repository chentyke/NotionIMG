// Elegant Loading System - Minimalist & Refined

let isLoadingComplete = false;

/**
 * Updates the loading progress with elegant simplicity
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingProgress(progress) {
    // Ensure progress is between 0 and 100
    const safeProgress = Math.max(0, Math.min(100, progress));
    
    // Update loading text based on progress
    updateLoadingText(safeProgress);
    
    if (safeProgress >= 100 && !isLoadingComplete) {
        isLoadingComplete = true;
        setTimeout(() => {
            // Fade out loading overlay with smooth animation
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
        }, 800);
    }
}

/**
 * Updates the loading text with elegant transitions
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingText(progress) {
    const loadingText = document.getElementById('loadingText');
    if (!loadingText) return;
    
    let text = '加载中...';
    
    if (progress < 30) {
        text = '准备中...';
    } else if (progress < 60) {
        text = '加载中...';
    } else if (progress < 90) {
        text = '渲染中...';
    } else if (progress < 100) {
        text = '即将完成...';
    } else {
        text = '加载完成';
    }
    
    // Smooth text transitions
    if (loadingText.textContent !== text) {
        loadingText.style.opacity = '0.6';
        setTimeout(() => {
            loadingText.textContent = text;
            loadingText.style.opacity = '1';
        }, 150);
    }
}

/**
 * Resets the loading state for next use
 */
function resetLoadingState() {
    isLoadingComplete = false;
    
    // Reset loading text
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
        loadingText.textContent = '加载中...';
        loadingText.style.opacity = '1';
    }
}

/**
 * Shows the loading overlay with elegant entrance
 */
function showLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.classList.remove('fade-out');
        
        // Reset state
        resetLoadingState();
        
        // Smooth entrance animation
        requestAnimationFrame(() => {
            loadingOverlay.style.opacity = '1';
        });
    }
}

/**
 * Hides the loading overlay with elegant exit
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

// Export functions for use in other modules
window.updateLoadingProgress = updateLoadingProgress;
window.showLoadingOverlay = showLoadingOverlay;
window.hideLoadingOverlay = hideLoadingOverlay; 