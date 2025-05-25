// Enhanced Image handling with robust error handling and HEIC support
import { smartImageLoader, isHEICImage } from './heicConverter.js';

// Create image observer for lazy loading
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            // 检查loading状态：只有当loading不是'true'时才加载
            if (img.dataset.src && img.dataset.loading !== 'true') {
                loadImageWithAnimation(img);
                observer.unobserve(img);
            }
        }
    });
}, {
    rootMargin: '100px 0px',
    threshold: 0.1
});

/**
 * Initialize image observer for all images with data-src
 * Can be called multiple times safely
 */
function initImageObserver() {
    const lazyImages = document.querySelectorAll('img[data-src]:not([data-observing])');
    console.log(`Initializing image observer for ${lazyImages.length} images`);
    
    lazyImages.forEach(img => {
        // 检查状态：只要没有正在加载或已加载，就可以观察
        const isLoading = img.dataset.loading === 'true';
        const isLoaded = img.dataset.loaded === 'true';
        const isObserving = img.dataset.observing === 'true';
        
        // 检查是否图片处于"卡住"的加载状态（有loading标记但没有实际在加载）
        if (isLoading && !img.src && img.complete) {
            console.warn('Found stuck image, resetting state:', img.dataset.src);
            img.dataset.loading = 'false';
            img.dataset.loaded = 'false';
        }
        
        if (!isObserving && !isLoading && !isLoaded) {
            img.dataset.observing = 'true';
            imageObserver.observe(img);
        }
    });
}

/**
 * Loads an image with elegant animation and robust error handling
 * @param {HTMLImageElement} img - The image element to load
 * @returns {Promise<void>}
 */
async function loadImageWithAnimation(img) {
    const imgSrc = img.dataset.src;
    
    // 防止重复加载
    const isLoading = img.dataset.loading === 'true';
    const isLoaded = img.dataset.loaded === 'true';
    
    if (isLoading || isLoaded) {
        return;
    }

    img.dataset.loading = 'true';
    
    try {
        const wrapper = img.closest('.image-wrapper') || img.closest('.image-container');
        if (wrapper) {
            wrapper.classList.add('loading');
            wrapper.classList.remove('error'); // 清除之前的错误状态
        }

        // Get original URL
        const originalUrl = img.dataset.src;
        
        // Check if this is a HEIC image and handle conversion
        const isHeicImage = isHEICImage(originalUrl);
        
        let finalImageUrl = originalUrl;
        
        if (isHeicImage) {
            try {
                finalImageUrl = await smartImageLoader(originalUrl, wrapper, {
                    quality: 0.85,
                    maxWidth: 1920,
                    maxHeight: 1080
                });
                
                if (finalImageUrl !== originalUrl) {
                    console.log('✅ HEIC图片转换成功');
                }
            } catch (heicError) {
                console.error('❌ HEIC转换失败:', heicError.message);
                finalImageUrl = originalUrl;
                
                if (wrapper) {
                    showHEICFailureNotification(wrapper, heicError.message);
                }
            }
        }

        // Create a new image to preload
        const preloadImg = new Image();
        preloadImg.crossOrigin = "anonymous";
        
        let loadingTimeout;
        let loadCompleted = false; // 使用更明确的状态标志
        let timeoutTriggered = false;
        
        // 创建Promise来处理加载结果
        const loadPromise = new Promise((resolve, reject) => {
            // Set up loading states with timeout
            preloadImg.onload = () => {
                if (!timeoutTriggered) {
                    loadCompleted = true;
                    clearTimeout(loadingTimeout);
                    console.log('Image loaded successfully:', originalUrl);
                    resolve(preloadImg);
                }
            };

            preloadImg.onerror = (event) => {
                if (!timeoutTriggered) {
                    loadCompleted = true;
                    clearTimeout(loadingTimeout);
                    reject(new Error('Image load failed'));
                }
            };

            // Set loading timeout
            loadingTimeout = setTimeout(() => {
                if (!loadCompleted) {
                    timeoutTriggered = true;
                    reject(new Error('timeout'));
                }
            }, 20000);
        });

        // Start loading with the final URL (converted if HEIC)
        preloadImg.src = finalImageUrl;

        try {
            const loadedImg = await loadPromise;
            // 成功加载，优化并显示图片
            await optimizeAndDisplayImage(img, loadedImg, wrapper);
            
            // 标记为成功加载
            img.dataset.loaded = 'true';
            img.dataset.loading = 'false';
            
        } catch (error) {
            if (error.message === 'timeout') {
                // 超时情况下，尝试直接设置图片源
                try {
                    img.src = finalImageUrl;
                    img.dataset.loaded = 'true';
                    img.dataset.loading = 'false';
                    if (wrapper) {
                        wrapper.classList.remove('loading');
                        wrapper.classList.add('loaded');
                    }
                    setTimeout(() => {
                        if (img.complete && img.naturalWidth > 0) {
                            return; // 成功加载，不显示错误
                        } else {
                            handleImageError(img, wrapper, originalUrl, isHeicImage, 'timeout');
                        }
                    }, 1000);
                } catch {
                    handleImageError(img, wrapper, originalUrl, isHeicImage, 'timeout');
                }
            } else {
                handleImageError(img, wrapper, originalUrl, isHeicImage, 'load');
            }
            img.dataset.loading = 'false';
        }

    } catch (error) {
        console.error('Error in loadImageWithAnimation:', error);
        const wrapper = img.closest('.image-wrapper') || img.closest('.image-container');
        handleImageError(img, wrapper, img.dataset.src, false, 'exception');
        img.dataset.loading = 'false';
    }
}

/**
 * Optimizes and displays the loaded image
 * @param {HTMLImageElement} targetImg - The target image element
 * @param {HTMLImageElement} preloadImg - The preloaded image
 * @param {HTMLElement} wrapper - The image wrapper element
 */
async function optimizeAndDisplayImage(targetImg, preloadImg, wrapper) {
    try {
        const naturalWidth = preloadImg.naturalWidth;
        const naturalHeight = preloadImg.naturalHeight;
        const fileSize = naturalWidth * naturalHeight * 4; // Rough estimate
        
        // For large images, compress them
        if (fileSize > 2000000 || naturalWidth > 1920) {
            try {
                const compressedSrc = await compressImage(preloadImg);
                displayImage(targetImg, compressedSrc, wrapper);
            } catch (compressionError) {
                console.warn('Image compression failed, using original:', compressionError);
                displayImage(targetImg, preloadImg.src, wrapper);
            }
        } else {
            displayImage(targetImg, preloadImg.src, wrapper);
        }
    } catch (error) {
        console.error('Error optimizing image:', error);
        displayImage(targetImg, preloadImg.src, wrapper);
    }
}

/**
 * Displays the image with smooth animation
 * @param {HTMLImageElement} img - The image element
 * @param {string} src - The image source
 * @param {HTMLElement} wrapper - The wrapper element
 */
function displayImage(img, src, wrapper) {
    try {
        img.src = src;
        
        // 使用更可靠的加载检测
        const checkImageLoad = () => {
            if (img.complete && img.naturalWidth > 0) {
                img.classList.add('loaded');
                img.style.opacity = '1'; // 确保图片可见
                
                if (wrapper) {
                    wrapper.classList.remove('loading', 'error');
                    wrapper.classList.add('loaded');
                }
                console.log('Image displayed successfully:', src);
            } else {
                // 如果图片还没完全加载，等待onload事件
                img.onload = () => {
                    img.classList.add('loaded');
                    img.style.opacity = '1';
                    
                    if (wrapper) {
                        wrapper.classList.remove('loading', 'error');
                        wrapper.classList.add('loaded');
                    }
                    console.log('Image displayed successfully (via onload):', src);
                };
                
                // 添加错误处理，但延迟触发避免误报
                img.onerror = () => {
                    setTimeout(() => {
                        if (!img.complete || img.naturalWidth === 0) {
                            console.error('Image failed to display:', src);
                            if (wrapper) {
                                wrapper.classList.remove('loading');
                                wrapper.classList.add('error');
                            }
                        }
                    }, 500); // 延迟500ms检查，避免竞态条件
                };
            }
        };
        
        // 立即检查一次，然后在下一帧再检查一次
        checkImageLoad();
        requestAnimationFrame(() => {
            checkImageLoad();
        });
        
    } catch (error) {
        console.error('Error in displayImage:', error);
        if (wrapper) {
            wrapper.classList.remove('loading');
            wrapper.classList.add('error');
        }
    }
}

/**
 * Handles image loading errors gracefully with enhanced error info and download option
 * Only shows error if image truly failed to load
 * @param {HTMLImageElement} img - The image element
 * @param {HTMLElement} wrapper - The wrapper element
 * @param {string} originalUrl - The original image URL
 * @param {boolean} isHeic - Whether the image is HEIC format
 * @param {string} errorType - Type of error (timeout, exception, etc.)
 */
function handleImageError(img, wrapper, originalUrl, isHeic = false, errorType = 'load') {
    // 最后一次检查图片是否实际已经加载成功
    if (img && img.complete && img.naturalWidth > 0 && img.src) {
        console.log('Image appears to be loaded despite error, not showing error UI:', originalUrl);
        displayImage(img, img.src, wrapper);
        return;
    }
    
    console.warn('Confirmed image load failure:', {
        url: originalUrl,
        isHeic,
        errorType,
        imgComplete: img?.complete,
        imgNaturalWidth: img?.naturalWidth,
        imgSrc: img?.src
    });
    
    if (!wrapper) {
        // Create wrapper if it doesn't exist
        wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
    }
    
    wrapper.classList.remove('loading');
    wrapper.classList.add('error');
    
    // 为错误的图片添加重试机制的标记
    if (img) {
        img.dataset.error = 'true';
        img.dataset.errorType = errorType;
        img.dataset.originalUrl = originalUrl;
    }
    
    // Determine error message based on type and format
    let errorMessage = 'Failed to load image';
    let errorDetails = '';
    
    if (isHeic) {
        errorMessage = 'HEIC图片处理失败';
        errorDetails = '我们尝试转换这张HEIC图片以便显示，但是转换失败了。您可以尝试下载原图片或重试。';
    } else if (errorType === 'timeout') {
        errorMessage = 'Image loading timeout';
        errorDetails = 'The image took too long to load. It might still be loading in the background.';
    } else {
        errorMessage = 'Failed to load image';
        errorDetails = 'The image could not be loaded. It may be corrupted or the server is unavailable.';
    }
    
    // Create enhanced error UI with download option
    wrapper.innerHTML = `
        <div class="image-error" style="
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            border: 2px dashed #dee2e6;
            border-radius: 12px;
            padding: 2rem;
            text-align: center;
            min-height: 200px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 1rem;
            transition: all 0.3s ease;
        ">
            <div style="
                background: #ff6b6b;
                color: white;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                margin-bottom: 0.5rem;
            ">⚠️</div>
            
            <div style="color: #495057; font-weight: 600; font-size: 1.1rem; margin-bottom: 0.5rem;">
                ${errorMessage}
            </div>
            
            ${errorDetails ? `<div style="color: #6c757d; font-size: 0.9rem; margin-bottom: 1rem; max-width: 300px; line-height: 1.4;">
                ${errorDetails}
            </div>` : ''}
            
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;">
                <button onclick="retryImageLoad(this)" 
                        style="
                            background: #007bff;
                            color: white;
                            border: none;
                            padding: 0.75rem 1.5rem;
                            border-radius: 8px;
                            font-size: 0.9rem;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            gap: 0.5rem;
                        "
                        onmouseover="this.style.background='#0056b3'; this.style.transform='translateY(-1px)'"
                        onmouseout="this.style.background='#007bff'; this.style.transform='translateY(0)'">
                    🔄 Retry
                </button>
                
                <button onclick="downloadImage('${originalUrl}')" 
                        style="
                            background: #28a745;
                            color: white;
                            border: none;
                            padding: 0.75rem 1.5rem;
                            border-radius: 8px;
                            font-size: 0.9rem;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            gap: 0.5rem;
                        "
                        onmouseover="this.style.background='#1e7e34'; this.style.transform='translateY(-1px)'"
                        onmouseout="this.style.background='#28a745'; this.style.transform='translateY(0)'">
                    📥 Download
                </button>
                
                <button onclick="openImageInNewTab('${originalUrl}')" 
                        style="
                            background: #6c757d;
                            color: white;
                            border: none;
                            padding: 0.75rem 1.5rem;
                            border-radius: 8px;
                            font-size: 0.9rem;
                            font-weight: 500;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            display: flex;
                            align-items: center;
                            gap: 0.5rem;
                        "
                        onmouseover="this.style.background='#545b62'; this.style.transform='translateY(-1px)'"
                        onmouseout="this.style.background='#6c757d'; this.style.transform='translateY(0)'">
                    🔗 Open Link
                </button>
            </div>
            
            ${isHeic ? `<div style="
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 0.75rem;
                border-radius: 6px;
                font-size: 0.85rem;
                margin-top: 1rem;
                max-width: 400px;
            ">
                💡 <strong>Tip:</strong> HEIC is Apple's image format. For better compatibility, consider converting to JPG or PNG.
            </div>` : ''}
        </div>
    `;
}

/**
 * Downloads an image from the given URL
 * @param {string} imageUrl - The image URL to download
 */
function downloadImage(imageUrl) {
    try {
        // Create a temporary anchor element for download
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = getFilenameFromUrl(imageUrl) || 'image';
        link.target = '_blank';
        
        // Append to body temporarily
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success message
        showDownloadToast('Download started successfully!', 'success');
    } catch (error) {
        console.error('Error downloading image:', error);
        showDownloadToast('Download failed. Please try opening the link manually.', 'error');
        
        // Fallback: open in new tab
        openImageInNewTab(imageUrl);
    }
}

/**
 * Opens image in a new tab
 * @param {string} imageUrl - The image URL to open
 */
function openImageInNewTab(imageUrl) {
    try {
        window.open(imageUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
        console.error('Error opening image:', error);
        showDownloadToast('Failed to open image. Please check the URL.', 'error');
    }
}

/**
 * Extracts filename from URL
 * @param {string} url - The URL to extract filename from
 * @returns {string} - The extracted filename
 */
function getFilenameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop();
        return filename || 'image';
    } catch (error) {
        return 'image';
    }
}

/**
 * Shows a toast message for download operations
 * @param {string} message - The message to show
 * @param {string} type - The type of message (success, error, info)
 */
function showDownloadToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.download-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'download-toast';
    
    const bgColor = type === 'success' ? '#28a745' : 
                   type === 'error' ? '#dc3545' : '#007bff';
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        z-index: 10000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 300px;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    });
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

/**
 * Retries loading a failed image with smarter recovery strategies
 * @param {HTMLElement} button - The retry button
 */
function retryImageLoad(button) {
    const wrapper = button.closest('.image-wrapper') || button.closest('.image-container');
    if (!wrapper) return;
    
    // Find the original img element data
    const errorDiv = wrapper.querySelector('.image-error');
    if (!errorDiv) return;
    
    // Get the original data from the error message or try to find it in the DOM
    let originalSrc = '';
    let originalAlt = '';
    
    // Try to extract URL from download button
    const downloadBtn = errorDiv.querySelector('button[onclick*="downloadImage"]');
    if (downloadBtn) {
        const onclick = downloadBtn.getAttribute('onclick');
        const match = onclick.match(/downloadImage\('([^']+)'\)/);
        if (match) {
            originalSrc = match[1];
        }
    }
    
    if (!originalSrc) {
        console.error('Could not find original image source for retry');
        return;
    }
    
    console.log('Retrying image load for:', originalSrc);
    
    // 智能重试策略：首先尝试直接加载
    const quickRetry = async () => {
        try {
            // 创建一个临时图片来测试是否现在可以加载
            const testImg = new Image();
            testImg.crossOrigin = "anonymous";
            
            const testPromise = new Promise((resolve, reject) => {
                testImg.onload = () => resolve(testImg);
                testImg.onerror = () => reject(new Error('Quick retry failed'));
                
                // 快速测试，5秒超时
                setTimeout(() => reject(new Error('Quick retry timeout')), 5000);
            });
            
            testImg.src = originalSrc;
            await testPromise;
            
            // 如果快速测试成功，直接显示图片
            console.log('Quick retry successful:', originalSrc);
            wrapper.classList.remove('error', 'loading');
            wrapper.innerHTML = `<img src="${originalSrc}" alt="${originalAlt}" class="transition-opacity duration-300" style="opacity: 1;">`;
            wrapper.classList.add('loaded');
            
            return true;
            
        } catch (error) {
            console.log('Quick retry failed, falling back to normal loading:', error.message);
            return false;
        }
    };
    
    // 首先尝试快速重试
    quickRetry().then(success => {
        if (!success) {
            // 如果快速重试失败，使用完整的加载流程
            fallbackRetry();
        }
    });
    
    const fallbackRetry = () => {
        // Reset wrapper and create new img element
        wrapper.classList.remove('loaded', 'error');
        wrapper.classList.add('loading');
        wrapper.innerHTML = '<img src="" alt="" class="opacity-0 transition-all duration-300">';
        
        const newImg = wrapper.querySelector('img');
        newImg.dataset.src = originalSrc;
        newImg.alt = originalAlt;
        
        // 清除之前的加载状态
        newImg.dataset.loading = 'false';
        newImg.dataset.loaded = 'false';
        newImg.dataset.observing = 'false';
        
        // Add loading indicator
        wrapper.insertAdjacentHTML('beforeend', `
            <div class="loading-overlay" style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(255,255,255,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1;
                border-radius: 8px;
            ">
                <div style="
                    width: 32px;
                    height: 32px;
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #007bff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                "></div>
                <span style="
                    margin-left: 12px;
                    color: #007bff;
                    font-size: 14px;
                    font-weight: 500;
                ">重新加载中...</span>
            </div>
        `);
        
        // Add CSS animation if not already present
        if (!document.querySelector('#spin-animation')) {
            const style = document.createElement('style');
            style.id = 'spin-animation';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // 启动完整的加载流程
        loadImageWithAnimation(newImg);
    };
}

/**
 * Compresses an image for better performance
 * @param {HTMLImageElement} img - The image to compress
 * @returns {Promise<string>} - Compressed image data URL
 */
function compressImage(img) {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let { naturalWidth: width, naturalHeight: height } = img;
            
            // Calculate optimal size
            const maxSize = window.innerWidth <= 768 ? 800 : 1200;
            const aspectRatio = width / height;
            
            if (width > maxSize) {
                width = maxSize;
                height = width / aspectRatio;
            }
            if (height > maxSize) {
                height = maxSize;
                width = height * aspectRatio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // High quality compression
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(img, 0, 0, width, height);
            
            // Use WebP if supported, otherwise JPEG
            const format = supportsWebP() ? 'image/webp' : 'image/jpeg';
            const quality = 0.85;
            
            resolve(canvas.toDataURL(format, quality));
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Checks if the browser supports WebP format
 * @returns {boolean}
 */
function supportsWebP() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Preloads critical images for better UX
 * @param {string[]} imageSources - Array of image URLs to preload
 */
function preloadCriticalImages(imageSources) {
    imageSources.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });
}

/**
 * Periodically check for images that might have loaded despite showing error states
 * This helps recover from race conditions and timing issues
 */
function startImageHealthMonitor() {
    // 运行图片健康检查，每10秒检查一次
    setInterval(() => {
        checkImageHealthAndRecover();
    }, 10000);
    
    // 页面可见性变化时也检查一次
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(checkImageHealthAndRecover, 1000);
        }
    });
}

/**
 * Check all images for health and recover mis-labeled errors
 */
function checkImageHealthAndRecover() {
    const errorWrappers = document.querySelectorAll('.image-wrapper.error, .image-container.error');
    let recoveredCount = 0;
    
    errorWrappers.forEach(wrapper => {
        // 查找可能存在的img元素或从错误信息中获取URL
        let imgUrl = null;
        
        // 首先尝试查找隐藏的img元素
        const hiddenImg = wrapper.querySelector('img[data-original-url], img[src]');
        if (hiddenImg) {
            imgUrl = hiddenImg.dataset.originalUrl || hiddenImg.src || hiddenImg.dataset.src;
        }
        
        // 如果没找到，从下载按钮中提取URL
        if (!imgUrl) {
            const downloadBtn = wrapper.querySelector('button[onclick*="downloadImage"]');
            if (downloadBtn) {
                const onclick = downloadBtn.getAttribute('onclick');
                const match = onclick.match(/downloadImage\('([^']+)'\)/);
                if (match) {
                    imgUrl = match[1];
                }
            }
        }
        
        if (imgUrl) {
            // 测试图片是否现在可以加载
            const testImg = new Image();
            testImg.crossOrigin = "anonymous";
            
            testImg.onload = () => {
                console.log('Image health check: recovered failed image:', imgUrl);
                
                // 恢复图片显示
                wrapper.classList.remove('error');
                wrapper.classList.add('loaded');
                wrapper.innerHTML = `<img src="${imgUrl}" alt="" class="transition-opacity duration-300" style="opacity: 1;">`;
                
                recoveredCount++;
            };
            
            testImg.onerror = () => {
                // 图片确实无法加载，保持错误状态
                console.log('Image health check: confirmed failure for:', imgUrl);
            };
            
            // 启动健康检查，短超时
            setTimeout(() => {
                // 如果在3秒内没有加载完成，认为仍然失败
                if (!testImg.complete || testImg.naturalWidth === 0) {
                    console.log('Image health check: timeout for:', imgUrl);
                }
            }, 3000);
            
            testImg.src = imgUrl;
        }
    });
    
    if (recoveredCount > 0) {
        console.log(`Image health monitor recovered ${recoveredCount} images`);
    }
}

/**
 * Enhanced image loading status check
 * Checks if an image has actually loaded successfully even if marked as error
 * @param {HTMLImageElement} img - The image element to check
 * @returns {boolean} - True if image is actually loaded
 */
function isImageActuallyLoaded(img) {
    if (!img) return false;
    
    // 多重检查确保图片真的加载成功
    return img.complete && 
           img.naturalWidth > 0 && 
           img.naturalHeight > 0 && 
           img.src && 
           img.src !== window.location.href &&
           !img.src.includes('data:') || 
           (img.src.includes('data:') && img.src.length > 100); // 排除空的data URI
}

// 启动图片健康监控
if (typeof window !== 'undefined') {
    // 页面加载完成后启动监控
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startImageHealthMonitor);
    } else {
        startImageHealthMonitor();
    }
}

/**
 * 显示HEIC转换失败的简短通知
 * @param {HTMLElement} wrapper - 图片容器
 * @param {string} errorMessage - 错误信息
 */
function showHEICFailureNotification(wrapper, errorMessage) {
    if (!wrapper) return;
    
    // 移除已存在的通知
    const existingNotification = wrapper.querySelector('.heic-failure-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'heic-failure-notification';
    notification.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 500;
        z-index: 15;
        backdrop-filter: blur(4px);
        max-width: 200px;
        text-align: center;
    `;
    
    notification.innerHTML = `
        <div style="margin-bottom: 0.25rem;">⚠️ HEIC转换失败</div>
        <div style="font-size: 0.7rem; opacity: 0.9;">${errorMessage.slice(0, 50)}${errorMessage.length > 50 ? '...' : ''}</div>
    `;
    
    wrapper.appendChild(notification);
    
    // 5秒后自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Make functions globally accessible
window.retryImageLoad = retryImageLoad;
window.downloadImage = downloadImage;
window.openImageInNewTab = openImageInNewTab;
window.checkImageHealthAndRecover = checkImageHealthAndRecover;
window.isImageActuallyLoaded = isImageActuallyLoaded;
window.showHEICFailureNotification = showHEICFailureNotification;



// Export functions and objects
export {
    imageObserver,
    initImageObserver,
    loadImageWithAnimation as loadImage,
    compressImage,
    preloadCriticalImages,
    supportsWebP,
    startImageHealthMonitor,
    checkImageHealthAndRecover,
    isImageActuallyLoaded
}; 