// Enhanced Creative Loading System with Multi-Stage Animations

// Loading stages configuration
const LOADING_STAGES = {
    INIT: { 
        key: 'init', 
        text: '正在初始化应用...', 
        stage: '初始化应用', 
        minProgress: 0, 
        maxProgress: 15 
    },
    FETCH: { 
        key: 'fetch', 
        text: '正在获取页面数据...', 
        stage: '连接服务器', 
        minProgress: 15, 
        maxProgress: 40 
    },
    RENDER: { 
        key: 'render', 
        text: '正在渲染页面内容...', 
        stage: '构建页面', 
        minProgress: 40, 
        maxProgress: 75 
    },
    OPTIMIZE: { 
        key: 'optimize', 
        text: '正在优化页面显示...', 
        stage: '优化体验', 
        minProgress: 75, 
        maxProgress: 95 
    },
    COMPLETE: { 
        key: 'complete', 
        text: '加载完成！', 
        stage: '准备就绪', 
        minProgress: 95, 
        maxProgress: 100 
    }
};

let currentStage = null;
let loadingStartTime = null;
let typewriterTimeout = null;

/**
 * Initialize the loading system
 */
function initLoadingSystem() {
    loadingStartTime = Date.now();
    currentStage = null;
    updateLoadingStage(LOADING_STAGES.INIT);
    animateParticles();
    console.log('🚀 Enhanced loading system initialized');
}

/**
 * Updates the loading progress with enhanced animations and stage management
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} customText - Optional custom loading text
 */
function updateLoadingProgress(progress, customText = null) {
    const progressBar = document.getElementById('loadingProgressBar');
    const percentageDisplay = document.getElementById('loadingPercentage');
    
    if (!progressBar) return;
    
    // Ensure progress is between 0 and 100
    const safeProgress = Math.max(0, Math.min(100, progress));
    
    // Update progress percentage display
    if (percentageDisplay) {
        animateNumberChange(percentageDisplay, safeProgress);
    }
    
    // Determine current stage based on progress
    const newStage = determineStageFromProgress(safeProgress);
    if (newStage && newStage !== currentStage) {
        updateLoadingStage(newStage);
    }
    
    // Update progress text if custom text provided
    if (customText) {
        updateLoadingText(customText);
    }
    
    // Animate the progress bar with enhanced easing
    animateProgressBar(safeProgress);
    
    // Update status icons
    updateStatusIcons(safeProgress);
    
    // Handle completion
    if (safeProgress >= 100) {
        handleLoadingComplete();
    }
    
    console.log(`📊 Loading progress: ${safeProgress}% - Stage: ${currentStage?.key || 'unknown'}`);
}

/**
 * Determines the current loading stage based on progress
 * @param {number} progress - Current progress percentage
 * @returns {Object|null} - Stage object or null
 */
function determineStageFromProgress(progress) {
    for (const stage of Object.values(LOADING_STAGES)) {
        if (progress >= stage.minProgress && progress < stage.maxProgress) {
            return stage;
        }
    }
    // Handle completion case
    if (progress >= 100) {
        return LOADING_STAGES.COMPLETE;
    }
    return null;
}

/**
 * Updates the current loading stage with animations
 * @param {Object} stage - Stage configuration object
 */
function updateLoadingStage(stage) {
    if (!stage || stage === currentStage) return;
    
    currentStage = stage;
    const stageElement = document.getElementById('loadingStage');
    const textElement = document.getElementById('loadingText');
    
    if (stageElement) {
        // Animate stage change
        stageElement.style.opacity = '0';
        stageElement.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            stageElement.textContent = stage.stage;
            stageElement.style.opacity = '1';
            stageElement.style.transform = 'translateY(0)';
        }, 200);
    }
    
    if (textElement) {
        updateLoadingTextWithTypewriter(stage.text);
    }
    
    console.log(`🎯 Stage updated: ${stage.key} - ${stage.stage}`);
}

/**
 * Updates loading text with typewriter effect
 * @param {string} text - Text to display
 */
function updateLoadingTextWithTypewriter(text) {
    const textElement = document.getElementById('loadingText');
    if (!textElement) return;
    
    // Clear any existing timeout
    if (typewriterTimeout) {
        clearTimeout(typewriterTimeout);
    }
    
    // Reset text
    textElement.textContent = '';
    textElement.style.borderRightColor = 'var(--link-color)';
    
    let charIndex = 0;
    const typeSpeed = 50; // milliseconds per character
    
    function typeNextChar() {
        if (charIndex < text.length) {
            textElement.textContent += text.charAt(charIndex);
            charIndex++;
            typewriterTimeout = setTimeout(typeNextChar, typeSpeed);
        } else {
            // Fade out cursor after typing is complete
            setTimeout(() => {
                textElement.style.borderRightColor = 'transparent';
            }, 1000);
        }
    }
    
    typeNextChar();
}

/**
 * Simple text update without typewriter effect
 * @param {string} text - Text to display
 */
function updateLoadingText(text) {
    const textElement = document.getElementById('loadingText');
    if (textElement) {
        textElement.textContent = text;
    }
}

/**
 * Animates the progress bar with enhanced easing and effects
 * @param {number} targetProgress - Target progress percentage
 */
function animateProgressBar(targetProgress) {
    const progressBar = document.getElementById('loadingProgressBar');
    if (!progressBar) return;
    
    const currentWidth = parseFloat(progressBar.style.width || '0');
    const targetWidth = targetProgress;
    
    if (Math.abs(currentWidth - targetWidth) < 0.1) return;
    
    // Use requestAnimationFrame for ultra-smooth animation
    const duration = 800; // ms
    const startTime = performance.now();
    
    function animate(time) {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Enhanced easing function (ease-out-cubic with bounce)
        const easeProgress = progress < 0.9 
            ? 1 - Math.pow(1 - progress, 3)
            : 1 - Math.pow(1 - progress, 3) + Math.sin((progress - 0.9) * 50) * 0.02;
        
        const currentValue = currentWidth + (targetWidth - currentWidth) * easeProgress;
        progressBar.style.width = `${Math.max(0, Math.min(100, currentValue))}%`;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

/**
 * Animates number change with counting effect
 * @param {HTMLElement} element - Element to update
 * @param {number} targetValue - Target number value
 */
function animateNumberChange(element, targetValue) {
    const currentValue = parseFloat(element.textContent) || 0;
    const difference = targetValue - currentValue;
    
    if (Math.abs(difference) < 0.1) return;
    
    const duration = 600;
    const steps = 30;
    const stepValue = difference / steps;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    
    const timer = setInterval(() => {
        currentStep++;
        const newValue = currentValue + (stepValue * currentStep);
        
        if (currentStep >= steps) {
            element.textContent = `${Math.round(targetValue)}%`;
            clearInterval(timer);
        } else {
            element.textContent = `${Math.round(newValue)}%`;
        }
    }, stepDuration);
}

/**
 * Updates the status icons based on current progress
 * @param {number} progress - Current progress percentage
 */
function updateStatusIcons(progress) {
    const iconsContainer = document.getElementById('loadingStatusIcons');
    if (!iconsContainer) return;
    
    const icons = iconsContainer.querySelectorAll('.loading-status-icon');
    
    icons.forEach(icon => {
        const stage = icon.dataset.stage;
        const stageConfig = Object.values(LOADING_STAGES).find(s => s.key === stage);
        
        if (!stageConfig) return;
        
        // Remove all classes first
        icon.classList.remove('active', 'completed');
        
        if (progress >= stageConfig.maxProgress) {
            // Stage completed
            icon.classList.add('completed');
        } else if (progress >= stageConfig.minProgress && progress < stageConfig.maxProgress) {
            // Stage active
            icon.classList.add('active');
        }
    });
}

/**
 * Handles loading completion with celebration animation
 */
function handleLoadingComplete() {
    console.log('🎉 Loading completed successfully!');
    
    const progressContainer = document.getElementById('loadingProgress');
    const overlay = document.getElementById('loadingOverlay');
    
    // Add completion class for special animation
    if (progressContainer) {
        progressContainer.classList.add('complete');
    }
    
    // Celebrate with final stage
    updateLoadingStage(LOADING_STAGES.COMPLETE);
    
    // Final animation sequence
    setTimeout(() => {
        // Add success animation to entire overlay
        if (overlay) {
            overlay.style.animation = 'slideUpFade 0.5s ease-out reverse';
        }
        
        setTimeout(() => {
            // Fade out the overlay
            if (overlay) {
                overlay.classList.add('fade-out');
                setTimeout(() => {
                    overlay.style.display = 'none';
                    overlay.classList.remove('fade-out');
                    resetLoadingSystem();
                }, 600);
            }
        }, 300);
    }, 800);
}

/**
 * Animates floating particles
 */
function animateParticles() {
    const particles = document.querySelectorAll('.loading-particle');
    
    particles.forEach((particle, index) => {
        // Random initial position
        const randomTop = Math.random() * 100;
        const randomDelay = Math.random() * 4;
        
        particle.style.top = `${randomTop}%`;
        particle.style.animationDelay = `-${randomDelay}s`;
        
        // Add random color variation
        const colors = [
            'var(--link-color)',
            'rgba(168, 85, 247, 0.6)',
            'rgba(236, 72, 153, 0.6)',
            'rgba(34, 197, 94, 0.6)'
        ];
        particle.style.background = colors[index % colors.length];
    });
}

/**
 * Resets the loading system for next use
 */
function resetLoadingSystem() {
    currentStage = null;
    loadingStartTime = null;
    
    if (typewriterTimeout) {
        clearTimeout(typewriterTimeout);
        typewriterTimeout = null;
    }
    
    // Reset all elements to initial state
    const progressBar = document.getElementById('loadingProgressBar');
    const percentageDisplay = document.getElementById('loadingPercentage');
    const progressContainer = document.getElementById('loadingProgress');
    
    if (progressBar) progressBar.style.width = '0%';
    if (percentageDisplay) percentageDisplay.textContent = '0%';
    if (progressContainer) progressContainer.classList.remove('complete');
    
    console.log('🔄 Loading system reset');
}

/**
 * Sets a specific loading stage manually
 * @param {string} stageKey - Stage key (init, fetch, render, optimize, complete)
 * @param {number} progress - Progress percentage for this stage
 */
function setLoadingStage(stageKey, progress = null) {
    const stage = Object.values(LOADING_STAGES).find(s => s.key === stageKey);
    if (stage) {
        updateLoadingStage(stage);
        if (progress !== null) {
            updateLoadingProgress(progress);
        }
    }
}

/**
 * Updates loading with custom message and progress
 * @param {number} progress - Progress percentage
 * @param {string} message - Custom message
 * @param {string} stageText - Custom stage text
 */
function updateLoadingWithMessage(progress, message, stageText = null) {
    updateLoadingProgress(progress, message);
    
    if (stageText) {
        const stageElement = document.getElementById('loadingStage');
        if (stageElement) {
            stageElement.textContent = stageText;
        }
    }
}

// Export functions
export {
    initLoadingSystem,
    updateLoadingProgress,
    updateLoadingText,
    animateProgressBar,
    setLoadingStage,
    updateLoadingWithMessage,
    resetLoadingSystem,
    LOADING_STAGES
}; 