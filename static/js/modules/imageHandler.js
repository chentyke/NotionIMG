// Enhanced Image handling with elegant loading animations

// Optimize image loading with IntersectionObserver
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
    rootMargin: '100px 0px', // Increased for better UX
    threshold: 0.1
});

/**
 * Loads an image with elegant animation
 * @param {HTMLImageElement} img - The image element to load
 * @returns {Promise<void>}
 */
async function loadImageWithAnimation(img) {
    try {
        const wrapper = img.closest('.image-wrapper');
        if (wrapper) {
            wrapper.classList.add('loading');
        }

        // Create a new image to preload
        const preloadImg = new Image();
        preloadImg.crossOrigin = "anonymous";
        
        // Set up loading states
        preloadImg.onload = () => {
            // Optimize image if needed
            optimizeAndDisplayImage(img, preloadImg, wrapper);
        };

        preloadImg.onerror = () => {
            handleImageError(img, wrapper, preloadImg.src);
        };

        // Start loading
        preloadImg.src = img.dataset.src;

    } catch (error) {
        console.error('Error loading image:', error);
        handleImageError(img, img.closest('.image-wrapper'), img.dataset.src);
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
        // Check if image needs compression based on size
        const naturalWidth = preloadImg.naturalWidth;
        const naturalHeight = preloadImg.naturalHeight;
        const fileSize = naturalWidth * naturalHeight * 4; // Rough estimate
        
        // For large images, compress them
        if (fileSize > 2000000 || naturalWidth > 1920) { // ~2MB or wider than 1920px
            compressImage(preloadImg)
                .then(compressedSrc => {
                    displayImage(targetImg, compressedSrc, wrapper);
                })
                .catch(() => {
                    // Fallback to original if compression fails
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
    
    // Add smooth transition
    requestAnimationFrame(() => {
        img.classList.add('loaded');
        
        if (wrapper) {
            wrapper.classList.remove('loading');
            wrapper.classList.add('loaded');
        }
    });
}

/**
 * Handles image loading errors gracefully
 * @param {HTMLImageElement} img - The image element
 * @param {HTMLElement} wrapper - The wrapper element
 * @param {string} failedSrc - The source URL that failed to load
 */
function handleImageError(img, wrapper, failedSrc = '') {
    const originalSrc = img.dataset.src || failedSrc;
    console.error('Failed to load image:', originalSrc);
    
    // Check if it's a HEIC format issue
    const isHeicFormat = originalSrc.toLowerCase().includes('.heic');
    const isNotionImage = originalSrc.includes('prod-files-secure.s3.us-west-2.amazonaws.com');
    
    if (wrapper) {
        wrapper.classList.remove('loading');
        
        let errorMessage = 'Failed to load image';
        let showRetry = true;
        
        if (isHeicFormat) {
            errorMessage = 'HEIC format not supported by browser';
            showRetry = false; // HEIC won't work with retry
        } else if (isNotionImage && originalSrc.includes('X-Amz-Expires')) {
            errorMessage = 'Image link expired - please refresh the page';
            showRetry = false; // Expired AWS links need page refresh
        }
        
        wrapper.innerHTML = `
            <div class="image-error text-center p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <div class="text-4xl mb-3">📷</div>
                <div class="text-gray-600 mb-2">${errorMessage}</div>
                ${isHeicFormat ? `
                    <div class="text-sm text-gray-500 mb-3">
                        HEIC images are not supported in web browsers.<br>
                        Please convert to JPG, PNG, or WebP format.
                    </div>
                ` : ''}
                ${showRetry ? `
                    <button onclick="retryImageLoad(this)" 
                            class="mt-2 px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        <i class="fa fa-refresh mr-1"></i> Retry
                    </button>
                ` : isNotionImage ? `
                    <button onclick="window.location.reload()" 
                            class="mt-2 px-4 py-2 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                        <i class="fa fa-refresh mr-1"></i> Refresh Page
                    </button>
                ` : ''}
                <div class="text-xs text-gray-400 mt-3 break-all">${originalSrc}</div>
            </div>
        `;
    }
}

/**
 * Retries loading a failed image
 * @param {HTMLElement} button - The retry button
 */
function retryImageLoad(button) {
    const wrapper = button.closest('.image-wrapper') || button.closest('.image-container');
    if (!wrapper) return;
    
    const img = wrapper.querySelector('img');
    if (!img || !img.dataset.src) return;
    
    // Reset wrapper
    wrapper.classList.remove('loaded');
    wrapper.classList.add('loading');
    wrapper.innerHTML = '<img src="" alt="" class="opacity-0 transition-all duration-300">';
    
    const newImg = wrapper.querySelector('img');
    newImg.dataset.src = img.dataset.src;
    newImg.alt = img.alt;
    
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

// Make retry function globally accessible
window.retryImageLoad = retryImageLoad;

// Export functions and objects
export {
    imageObserver,
    loadImageWithAnimation as loadImage,
    compressImage,
    preloadCriticalImages,
    supportsWebP
}; 