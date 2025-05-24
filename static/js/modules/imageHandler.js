// Enhanced Image handling with robust error handling and HEIC support

// Create image observer for lazy loading
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
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
    const lazyImages = document.querySelectorAll('img[data-src]');
    lazyImages.forEach(img => {
        // Only observe if not already being observed
        if (!img.dataset.observing) {
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
    try {
        const wrapper = img.closest('.image-wrapper') || img.closest('.image-container');
        if (wrapper) {
            wrapper.classList.add('loading');
        }

        // Get original URL
        const originalUrl = img.dataset.src;
        
        // Try to detect and handle HEIC images
        const isHeicImage = originalUrl.toLowerCase().includes('.heic') || 
                           originalUrl.toLowerCase().includes('heic');
        
        if (isHeicImage) {
            console.warn('HEIC image detected, may not be supported by browser:', originalUrl);
        }

        // Create a new image to preload
        const preloadImg = new Image();
        preloadImg.crossOrigin = "anonymous";
        
        let loadingTimeout;
        let hasLoaded = false;
        
        // Set up loading states with timeout
        preloadImg.onload = () => {
            hasLoaded = true;
            clearTimeout(loadingTimeout);
            optimizeAndDisplayImage(img, preloadImg, wrapper);
        };

        preloadImg.onerror = (event) => {
            hasLoaded = true;
            clearTimeout(loadingTimeout);
            console.error('Image load error:', {
                url: originalUrl,
                error: event,
                isHeic: isHeicImage
            });
            handleImageError(img, wrapper, originalUrl, isHeicImage);
        };

        // Set loading timeout (15 seconds)
        loadingTimeout = setTimeout(() => {
            if (!hasLoaded) {
                console.warn('Image loading timeout:', originalUrl);
                handleImageError(img, wrapper, originalUrl, isHeicImage, 'timeout');
            }
        }, 15000);

        // Start loading
        preloadImg.src = originalUrl;

    } catch (error) {
        console.error('Error in loadImageWithAnimation:', error);
        const wrapper = img.closest('.image-wrapper') || img.closest('.image-container');
        handleImageError(img, wrapper, img.dataset.src, false, 'exception');
    }
}

/**
 * Optimizes and displays the loaded image
 * @param {HTMLImageElement} targetImg - The target image element
 * @param {HTMLImageElement} preloadImg - The preloaded image
 * @param {HTMLElement} wrapper - The image wrapper element
 */
function optimizeAndDisplayImage(targetImg, preloadImg, wrapper) {
    try {
        const naturalWidth = preloadImg.naturalWidth;
        const naturalHeight = preloadImg.naturalHeight;
        const fileSize = naturalWidth * naturalHeight * 4; // Rough estimate
        
        // For large images, compress them
        if (fileSize > 2000000 || naturalWidth > 1920) {
            compressImage(preloadImg)
                .then(compressedSrc => {
                    displayImage(targetImg, compressedSrc, wrapper);
                })
                .catch(() => {
                    displayImage(targetImg, preloadImg.src, wrapper);
                });
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
    img.src = src;
    
    requestAnimationFrame(() => {
        img.classList.add('loaded');
        
        if (wrapper) {
            wrapper.classList.remove('loading');
            wrapper.classList.add('loaded');
        }
    });
}

/**
 * Handles image loading errors gracefully with enhanced error info and download option
 * @param {HTMLImageElement} img - The image element
 * @param {HTMLElement} wrapper - The wrapper element
 * @param {string} originalUrl - The original image URL
 * @param {boolean} isHeic - Whether the image is HEIC format
 * @param {string} errorType - Type of error (timeout, exception, etc.)
 */
function handleImageError(img, wrapper, originalUrl, isHeic = false, errorType = 'load') {
    console.warn('Failed to load image:', {
        url: originalUrl,
        isHeic,
        errorType
    });
    
    if (!wrapper) {
        // Create wrapper if it doesn't exist
        wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';
        img.parentNode.insertBefore(wrapper, img);
        wrapper.appendChild(img);
    }
    
    wrapper.classList.remove('loading');
    
    // Determine error message based on type and format
    let errorMessage = 'Failed to load image';
    let errorDetails = '';
    
    if (isHeic) {
        errorMessage = 'HEIC image format not supported';
        errorDetails = 'Your browser cannot display HEIC images. Please use the download button to save the image.';
    } else if (errorType === 'timeout') {
        errorMessage = 'Image loading timeout';
        errorDetails = 'The image took too long to load. Check your connection and try again.';
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
 * Retries loading a failed image
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
    
    // Reset wrapper and create new img element
    wrapper.classList.remove('loaded');
    wrapper.classList.add('loading');
    wrapper.innerHTML = '<img src="" alt="" class="opacity-0 transition-all duration-300">';
    
    const newImg = wrapper.querySelector('img');
    newImg.dataset.src = originalSrc;
    newImg.alt = originalAlt;
    
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
        ">
            <div style="
                width: 40px;
                height: 40px;
                border: 3px solid #f3f3f3;
                border-top: 3px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
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
    
    loadImageWithAnimation(newImg);
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

// Make functions globally accessible
window.retryImageLoad = retryImageLoad;
window.downloadImage = downloadImage;
window.openImageInNewTab = openImageInNewTab;

// Export functions and objects
export {
    imageObserver,
    initImageObserver,
    loadImageWithAnimation as loadImage,
    compressImage,
    preloadCriticalImages,
    supportsWebP
}; 