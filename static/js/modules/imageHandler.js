// Image handling and optimization

// Optimize image loading with IntersectionObserver
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
                loadImage(img);
                observer.unobserve(img);
            }
        }
    });
}, {
    rootMargin: '50px 0px',
    threshold: 0.1
});

/**
 * Loads an image with progressive enhancement
 * @param {HTMLImageElement} img - The image element to load
 * @returns {Promise<void>}
 */
async function loadImage(img) {
    try {
        // Create a more sophisticated placeholder with aspect ratio
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder animate-pulse';
        
        // Try to maintain aspect ratio if available
        if (img.getAttribute('width') && img.getAttribute('height')) {
            const ratio = (parseInt(img.getAttribute('height')) / parseInt(img.getAttribute('width'))) * 100;
            placeholder.style.paddingBottom = `${ratio}%`;
        } else {
            placeholder.style.paddingBottom = '56.25%'; // Default 16:9 aspect ratio
        }
        
        img.parentNode.insertBefore(placeholder, img);

        // Preload a tiny thumbnail for instant feedback
        const thumbnailUrl = await compressImage(img.dataset.src, 5);
        img.src = thumbnailUrl;
        img.style.filter = 'blur(15px)';
        img.style.transform = 'scale(1.05)';
        img.classList.remove('opacity-0');
        
        // Then load a medium quality version for faster display
        const mediumQualityUrl = await compressImage(img.dataset.src, 40);
        img.src = mediumQualityUrl;
        img.style.filter = 'blur(5px)';
        img.style.transform = 'scale(1.02)';
                
        // Finally load the high quality version
        const fullQualityUrl = await compressImage(img.dataset.src, 85);
        const fullImg = new Image();
        fullImg.src = fullQualityUrl;
                
        fullImg.onload = () => {
            img.src = fullQualityUrl;
            img.style.filter = '';
            img.style.transform = '';
            img.classList.add('loaded');
            
            // Animate the placeholder removal
            if (placeholder) {
                placeholder.style.opacity = '0';
                setTimeout(() => placeholder.remove(), 300);
            }
        };
    } catch (error) {
        console.error('Error loading image:', error);
        img.src = img.dataset.src;
        img.classList.remove('opacity-0');
        img.onerror = () => {
            img.onerror = null;
            img.src = '';
            img.alt = 'Image failed to load';
            img.classList.add('image-error');
        };
    }
}

/**
 * Compresses an image to reduce file size
 * @param {string} url - The image URL to compress
 * @param {number} quality - Quality percentage (0-100)
 * @returns {Promise<string>} - Compressed image data URL
 */
function compressImage(url, quality = 80) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            let { width, height } = img;
            
            // 计算最大尺寸
            const maxSize = window.innerWidth <= 640 ? 800 : 1200;
            if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            }
            if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // 使用双线性插值
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality / 100));
        };
        img.onerror = reject;
        img.src = url;
    });
}

// Export functions and objects
export {
    imageObserver,
    loadImage,
    compressImage
}; 