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

// HEIC conversion library loading state
let heicLibraryLoaded = false;
let heicLibraryLoading = false;

/**
 * Load HEIC conversion library dynamically
 * @returns {Promise<boolean>} - Whether the library loaded successfully
 */
async function loadHeicLibrary() {
    if (heicLibraryLoaded) {
        return true;
    }
    
    if (heicLibraryLoading) {
        // Wait for existing load to complete
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!heicLibraryLoading) {
                    clearInterval(checkInterval);
                    resolve(heicLibraryLoaded);
                }
            }, 100);
        });
    }
    
    heicLibraryLoading = true;
    
    try {
        // Load heic2any library from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
        
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
        
        heicLibraryLoaded = true;
        console.log('HEIC conversion library loaded successfully');
        return true;
    } catch (error) {
        console.error('Failed to load HEIC conversion library:', error);
        return false;
    } finally {
        heicLibraryLoading = false;
    }
}

/**
 * Convert HEIC image to JPEG
 * @param {string} heicUrl - URL of the HEIC image
 * @returns {Promise<string>} - Data URL of converted JPEG
 */
async function convertHeicToJpeg(heicUrl) {
    try {
        // Load HEIC library if not already loaded
        const libraryLoaded = await loadHeicLibrary();
        if (!libraryLoaded) {
            throw new Error('HEIC conversion library failed to load');
        }
        
        // Fetch the HEIC file
        console.log('Downloading HEIC file for conversion...');
        const response = await fetch(heicUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch HEIC file: ${response.status}`);
        }
        
        const heicBlob = await response.blob();
        console.log(`HEIC file size: ${(heicBlob.size / 1024 / 1024).toFixed(2)} MB`);
        
        // Convert HEIC to JPEG using heic2any
        console.log('Converting HEIC to JPEG...');
        const convertedBlob = await heic2any({
            blob: heicBlob,
            toType: "image/jpeg",
            quality: 0.8 // High quality output
        });
        
        // Create object URL for the converted image
        const convertedUrl = URL.createObjectURL(convertedBlob);
        console.log('HEIC conversion completed successfully');
        
        return convertedUrl;
    } catch (error) {
        console.error('HEIC conversion failed:', error);
        throw error;
    }
}

/**
 * Check if URL is a HEIC image
 * @param {string} url - Image URL to check
 * @returns {boolean} - Whether the URL points to a HEIC image
 */
function isHeicFormat(url) {
    return url.toLowerCase().includes('.heic') || url.toLowerCase().includes('.heif');
}

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

        const originalSrc = img.dataset.src;
        
        // Check if it's a HEIC format
        if (isHeicFormat(originalSrc)) {
            console.log('HEIC format detected, attempting conversion...');
            await loadHeicImage(img, wrapper, originalSrc);
            return;
        }

        // Regular image loading
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
        preloadImg.src = originalSrc;

    } catch (error) {
        console.error('Error loading image:', error);
        handleImageError(img, img.closest('.image-wrapper'), img.dataset.src);
    }
}

/**
 * Load and convert HEIC image
 * @param {HTMLImageElement} img - The image element
 * @param {HTMLElement} wrapper - The wrapper element
 * @param {string} heicUrl - The HEIC image URL
 */
async function loadHeicImage(img, wrapper, heicUrl) {
    try {
        // Show HEIC conversion progress
        if (wrapper) {
            wrapper.innerHTML = `
                <div class="heic-conversion-progress text-center p-8 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg">
                    <div class="text-4xl mb-3">🔄</div>
                    <div class="text-blue-700 mb-2 font-medium">Converting HEIC image...</div>
                    <div class="text-sm text-blue-600 mb-3">
                        This may take a few seconds for large images
                    </div>
                    <div class="loading-spinner">
                        <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            `;
        }
        
        // Convert HEIC to JPEG
        const convertedUrl = await convertHeicToJpeg(heicUrl);
        
        // Create new image element for converted image
        const convertedImg = new Image();
        convertedImg.crossOrigin = "anonymous";
        
        convertedImg.onload = () => {
            // Success - display converted image
            img.src = convertedUrl;
            
            if (wrapper) {
                wrapper.classList.remove('loading');
                wrapper.classList.add('loaded');
                wrapper.innerHTML = `
                    <img src="${convertedUrl}" alt="${img.alt}" 
                         class="rounded-lg shadow-md transition-all duration-300 ease-out"
                         onclick="openImageModal('${convertedUrl}')" loading="lazy">
                    <div class="text-xs text-green-600 mt-2 text-center">
                        ✓ Converted from HEIC format
                    </div>
                `;
            }
            
            console.log('HEIC image successfully converted and displayed');
        };
        
        convertedImg.onerror = () => {
            throw new Error('Failed to load converted image');
        };
        
        convertedImg.src = convertedUrl;
        
    } catch (error) {
        console.error('HEIC conversion failed:', error);
        
        // Analyze the error type for better user feedback
        let errorType = 'unknown';
        let errorMessage = 'Unable to convert HEIC format';
        let detailedMessage = '';
        let showRetry = true;
        let showRefresh = false;
        
        if (error.message.includes('Failed to fetch')) {
            errorType = 'network';
            errorMessage = 'Network error';
            detailedMessage = 'Image link may be expired or inaccessible';
            showRefresh = true;
        } else if (error.message.includes('ERR_LIBHEIF format not supported') || error.code === 2) {
            errorType = 'format';
            errorMessage = 'HEIC format variant not supported';
            detailedMessage = 'This HEIC file uses an encoding format that cannot be converted in the browser';
            showRetry = false;
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            errorType = 'timeout';
            errorMessage = 'Conversion timeout';
            detailedMessage = 'The conversion took too long, possibly due to file size';
        } else if (error.message.includes('Invalid') || error.message.includes('corrupted')) {
            errorType = 'invalid';
            errorMessage = 'Invalid HEIC file';
            detailedMessage = 'The file may be corrupted or not a valid HEIC image';
            showRetry = false;
        }
        
        // Show conversion error with specific messaging
        if (wrapper) {
            wrapper.classList.remove('loading');
            wrapper.innerHTML = `
                <div class="image-error text-center p-8 bg-red-50 border-2 border-dashed border-red-300 rounded-lg">
                    <div class="text-4xl mb-3">${errorType === 'format' ? '🔧' : errorType === 'network' ? '🌐' : errorType === 'timeout' ? '⏱️' : '📷'}</div>
                    <div class="text-red-700 mb-2 font-medium">HEIC conversion failed</div>
                    <div class="text-sm text-red-600 mb-1 font-medium">${errorMessage}</div>
                    <div class="text-sm text-red-500 mb-3">${detailedMessage}</div>
                    
                    ${errorType === 'format' ? `
                        <div class="text-sm text-gray-600 mb-3 p-3 bg-gray-100 rounded">
                            <strong>💡 Suggestions:</strong><br>
                            • Try opening the image on iPhone/Mac and re-exporting as JPEG<br>
                            • Use online HEIC converters before uploading<br>
                            • Consider using standard formats (JPG, PNG, WebP) for web content
                        </div>
                    ` : ''}
                    
                    <div class="space-y-2">
                        ${showRetry ? `
                            <button onclick="retryHeicConversion(this, '${heicUrl}')" 
                                    class="mr-2 px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors">
                                🔄 Retry Conversion
                            </button>
                        ` : ''}
                        ${showRefresh ? `
                            <button onclick="window.location.reload()" 
                                    class="px-4 py-2 bg-green-500 text-white rounded-md text-sm hover:bg-green-600 transition-colors">
                                🔄 Refresh Page
                            </button>
                        ` : ''}
                        ${errorType === 'format' ? `
                            <button onclick="copyToClipboard('${heicUrl}')" 
                                    class="px-4 py-2 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600 transition-colors">
                                📋 Copy URL for External Conversion
                            </button>
                        ` : ''}
                    </div>
                    
                    <details class="mt-3 text-left">
                        <summary class="text-xs text-gray-500 cursor-pointer">Technical Details</summary>
                        <div class="text-xs text-gray-400 mt-2 p-2 bg-gray-50 rounded break-all">
                            <strong>Error:</strong> ${error.message || 'Unknown error'}<br>
                            <strong>Code:</strong> ${error.code || 'N/A'}<br>
                            <strong>URL:</strong> ${heicUrl}
                        </div>
                    </details>
                </div>
            `;
        }
    }
}

/**
 * Retry HEIC conversion
 * @param {HTMLElement} button - The retry button
 * @param {string} heicUrl - The HEIC image URL
 */
function retryHeicConversion(button, heicUrl) {
    const wrapper = button.closest('.image-wrapper') || button.closest('.image-container');
    if (!wrapper) return;
    
    // Reset wrapper and retry
    wrapper.classList.add('loading');
    wrapper.innerHTML = '<img src="" alt="" class="opacity-0 transition-all duration-300">';
    
    const newImg = wrapper.querySelector('img');
    newImg.dataset.src = heicUrl;
    newImg.alt = 'Converted HEIC image';
    
    loadHeicImage(newImg, wrapper, heicUrl);
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
            errorMessage = 'HEIC format detected';
            showRetry = false; // Will show HEIC-specific retry
        } else if (isNotionImage && originalSrc.includes('X-Amz-Expires')) {
            errorMessage = 'Image link expired - please refresh the page';
            showRetry = false; // Expired AWS links need page refresh
        }
        
        wrapper.innerHTML = `
            <div class="image-error text-center p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                <div class="text-4xl mb-3">📷</div>
                <div class="text-gray-600 mb-2">${errorMessage}</div>
                ${isHeicFormat ? `
                    <div class="text-sm text-blue-600 mb-3">
                        Browser doesn't natively support HEIC format.<br>
                        We can try to convert it for you!
                    </div>
                    <button onclick="retryHeicConversion(this, '${originalSrc}')" 
                            class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                        🔄 Convert HEIC to JPEG
                    </button>
                ` : showRetry ? `
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

/**
 * Copy text to clipboard with fallback support
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showCopyFeedback('URL copied to clipboard! You can use online HEIC converters.');
            })
            .catch(err => {
                console.error('Clipboard API failed:', err);
                fallbackCopyToClipboard(text);
            });
    } else {
        // Fallback for older browsers or non-secure contexts
        fallbackCopyToClipboard(text);
    }
}

/**
 * Fallback method to copy text to clipboard
 * @param {string} text - Text to copy
 */
function fallbackCopyToClipboard(text) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '2em';
        textarea.style.height = '2em';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = 'none';
        textarea.style.background = 'transparent';
        
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        if (successful) {
            showCopyFeedback('URL copied to clipboard! You can use online HEIC converters.');
        } else {
            showCopyFeedback('Copy failed. Please manually copy the URL from technical details.', 'error');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showCopyFeedback('Copy failed. Please manually copy the URL from technical details.', 'error');
    }
}

/**
 * Show feedback for copy operation
 * @param {string} message - Message to show
 * @param {string} type - Type of message ('success' or 'error')
 */
function showCopyFeedback(message, type = 'success') {
    // Remove existing feedback
    const existingFeedback = document.querySelector('.copy-feedback');
    if (existingFeedback) {
        existingFeedback.remove();
    }
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = `copy-feedback fixed top-4 right-4 p-3 rounded-lg shadow-lg z-50 text-sm font-medium transition-all duration-300 ${
        type === 'success' 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
    }`;
    feedback.innerHTML = `
        <div class="flex items-center">
            <span class="mr-2">${type === 'success' ? '✓' : '✗'}</span>
            ${message}
        </div>
    `;
    
    document.body.appendChild(feedback);
    
    // Animate in
    setTimeout(() => {
        feedback.style.transform = 'translateX(0)';
        feedback.style.opacity = '1';
    }, 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
        feedback.style.transform = 'translateX(100%)';
        feedback.style.opacity = '0';
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.remove();
            }
        }, 300);
    }, 4000);
}

// Make functions globally accessible
window.retryImageLoad = retryImageLoad;
window.retryHeicConversion = retryHeicConversion;
window.copyToClipboard = copyToClipboard;

// Export functions and objects
export {
    imageObserver,
    loadImageWithAnimation as loadImage,
    compressImage,
    preloadCriticalImages,
    supportsWebP,
    convertHeicToJpeg,
    isHeicFormat
}; 