// Image Modal functionality

/**
 * Opens an image modal with the specified image URL
 * @param {string} originalUrl - The URL of the image to display
 * @param {string} previewUrl - Optional preview URL for immediate display
 */
function openImageModal(originalUrl, previewUrl = null) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    // Reset any existing transforms/state
    resetImageModalState();
    
    // Show the modal immediately
    modal.style.display = "block";
    
    // Clear previous image and set initial state
    modalImg.classList.add('loading');
    modalImg.src = '';
    
    // Try to get preview from the clicked image if not provided
    if (!previewUrl) {
        const clickedImg = event?.target;
        if (clickedImg && clickedImg.tagName === 'IMG') {
            previewUrl = clickedImg.src;
        }
    }
    
    // If we have a preview, show it immediately
    if (previewUrl && previewUrl !== originalUrl) {
        modalImg.src = previewUrl;
        modalImg.classList.remove('loading');
        modal.classList.add('visible');
        
        // Add a subtle loading indicator for the high-res version
        addImageLoadingIndicator(modal);
    }
    
    // Preload the original high-resolution image
    const originalImg = new Image();
    originalImg.onload = () => {
        // Calculate optimal dimensions
        modalImg.style.maxWidth = `${Math.min(window.innerWidth * 0.9, originalImg.width)}px`;
        modalImg.style.maxHeight = `${window.innerHeight * 0.9}px`;
        
        // Smooth transition to high-res image
        if (previewUrl && previewUrl !== originalUrl) {
            // Create a smooth transition effect
            modalImg.style.transition = 'opacity 0.3s ease-in-out';
            modalImg.style.opacity = '0.7';
            
            setTimeout(() => {
                modalImg.src = originalUrl;
                modalImg.style.opacity = '1';
                removeImageLoadingIndicator(modal);
            }, 100);
        } else {
            // No preview, just show the original
            modalImg.src = originalUrl;
            modalImg.classList.remove('loading');
            modal.classList.add('visible');
        }
    };
    
    originalImg.onerror = () => {
        modalImg.classList.add('error');
        modalImg.classList.remove('loading');
        removeImageLoadingIndicator(modal);
        
        // If we don't have a preview, set the original URL anyway
        if (!previewUrl) {
            modalImg.src = originalUrl;
            modal.classList.add('visible');
        }
    };
    
    // Start loading original image
    originalImg.src = originalUrl;
    
    // If no preview available, show modal anyway with loading state
    if (!previewUrl) {
        setTimeout(() => {
            modal.classList.add('visible');
        }, 50);
    }
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Initialize zoom and pan variables
    initImageModalControls();
    
    // Add ESC key listener
    document.addEventListener('keydown', handleModalKeyDown);
}

/**
 * Adds a loading indicator for high-res image loading
 * @param {HTMLElement} modal - The modal element
 */
function addImageLoadingIndicator(modal) {
    // Remove existing indicator if any
    removeImageLoadingIndicator(modal);
    
    const indicator = document.createElement('div');
    indicator.className = 'hires-loading-indicator';
    indicator.innerHTML = `
        <div class="hires-loading-content">
            <div class="hires-loading-spinner"></div>
            <span class="hires-loading-text">加载高清图片中...</span>
        </div>
    `;
    
    modal.appendChild(indicator);
}

/**
 * Removes the loading indicator
 * @param {HTMLElement} modal - The modal element
 */
function removeImageLoadingIndicator(modal) {
    const indicator = modal.querySelector('.hires-loading-indicator');
    if (indicator) {
        indicator.style.opacity = '0';
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 200);
    }
}

/**
 * Closes the image modal with reverse animation
 * @param {Event} event - Optional event that triggered the close
 */
function closeImageModal(event) {
    // If this is a direct click event and not on the modal background, ignore it
    if (event && event.target && !event.target.classList.contains('modal-backdrop') && 
        !event.target.classList.contains('close-button')) {
        return;
    }
    
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const closeButton = modal.querySelector('.close-button');
    const downloadButton = document.getElementById('modalDownloadButton');
    
    // Immediately hide the buttons to sync with image animation
    if (closeButton) closeButton.style.opacity = '0';
    if (downloadButton) downloadButton.style.opacity = '0';
    
    // If we have a source position, animate back to it
    if (modalSourceRect) {
        animateToSourcePosition(modalImg, modalSourceRect);
        
        // Start fading the backdrop
        modal.classList.remove('visible');
        
        setTimeout(() => {
            completeModalClose(modal, modalImg, closeButton, downloadButton);
        }, 400); // Wait for animation to complete
    } else {
        // No source position, use default close animation
        modal.classList.remove('visible');
        
        setTimeout(() => {
            completeModalClose(modal, modalImg, closeButton, downloadButton);
        }, 300);
    }
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleModalKeyDown);
    
    // Re-enable scrolling on the body
    document.body.style.overflow = '';
}

/**
 * Completes the modal close process
 */
function completeModalClose(modal, modalImg, closeButton, downloadButton) {
    modal.style.display = "none";
    modalImg.classList.remove('loading', 'error');
    modalImg.src = '';
    
    // Reset transforms and transitions
    modalImg.style.transform = '';
    modalImg.style.transition = '';
    modalImg.style.opacity = '';
    
    // Reset opacity for next opening
    if (closeButton) closeButton.style.opacity = '';
    if (downloadButton) downloadButton.style.opacity = '';
    
    // Clear source rect
    modalSourceRect = null;
}

/**
 * Handles key presses when modal is open
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleModalKeyDown(event) {
    if (event.key === 'Escape') {
        closeImageModal();
    }
}

/**
 * Resets the modal image state
 */
function resetImageModalState() {
    const modalImg = document.getElementById('modalImage');
    if (modalImg) {
        modalImg.style.transform = '';
        modalImg.style.pointerEvents = 'auto';
    }
}

/**
 * Initializes image modal zoom and pan controls
 */
function initImageModalControls() {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('modalImage');
    
    let scale = 1;
    let panning = false;
    let pointX = 0;
    let pointY = 0;
    let startX = 0;
    let startY = 0;
    
    // Double-tap/click to zoom
    let lastTap = 0;
    
    function handleDoubleClick(e) {
        e.stopPropagation(); // Prevent the modal close
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < 300 && tapLength > 0) {
            // Double tap/click detected
            if (scale === 1) {
                // Zoom in to point
                const rect = img.getBoundingClientRect();
                pointX = (e.clientX - rect.left) / scale;
                pointY = (e.clientY - rect.top) / scale;
                
                scale = 2;
                updateTransform();
            } else {
                // Reset zoom
                resetImageTransforms();
            }
        }
        
        lastTap = currentTime;
    }
    
    // Reset transforms to default state
    function resetImageTransforms() {
        scale = 1;
        pointX = 0;
        pointY = 0;
        updateTransform();
    }
    
    // Update the image transform
    function updateTransform() {
        img.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
    }
    
    // Mouse wheel zoom
    function handleWheel(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = img.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Determine zoom direction
        const delta = Math.sign(e.deltaY) * -0.1;
        const newScale = Math.max(1, Math.min(4, scale + delta));
        
        if (newScale !== scale) {
            // Adjust points to zoom toward mouse position
            if (newScale > 1) {
                pointX = pointX + mouseX * (delta / scale);
                pointY = pointY + mouseY * (delta / scale);
            } else {
                // Reset position if zooming out to 1
                pointX = 0;
                pointY = 0;
            }
            
            scale = newScale;
            updateTransform();
        }
    }
    
    // Mouse and touch handlers for panning
    function handleMouseDown(e) {
        // Only if click is directly on the image
        if (e.target !== img) return;
        
        e.preventDefault();
        e.stopPropagation(); // Prevent closing modal
        
        if (scale > 1) {
            panning = true;
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
            
            // Change cursor
            img.style.cursor = 'grabbing';
        }
    }
    
    function handleMouseMove(e) {
        if (!panning) return;
        
        e.preventDefault();
        
        pointX = e.clientX - startX;
        pointY = e.clientY - startY;
        updateTransform();
    }
    
    function handleMouseUp(e) {
        panning = false;
        img.style.cursor = 'grab';
    }
    
    // Touch events for mobile
    let lastTouchDistance = 0;
    
    function handleTouchStart(e) {
        e.stopPropagation(); // Prevent closing modal
        
        if (e.touches.length === 1) {
            // Single touch - prepare for panning or double-tap
            if (scale > 1) {
                panning = true;
                startX = e.touches[0].clientX - pointX;
                startY = e.touches[0].clientY - pointY;
            }
            
            // Handle double-tap detection
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 300 && tapLength > 0) {
                // Double tap detected
                if (scale === 1) {
                    // Zoom in to point
                    const rect = img.getBoundingClientRect();
                    pointX = (e.touches[0].clientX - rect.left) / scale;
                    pointY = (e.touches[0].clientY - rect.top) / scale;
                    
                    scale = 2;
                    updateTransform();
                } else {
                    // Reset zoom
                    resetImageTransforms();
                }
                e.preventDefault();
            }
            
            lastTap = currentTime;
        } else if (e.touches.length === 2) {
            // Pinch zoom gesture
            e.preventDefault();
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            lastTouchDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            // Disable panning while pinching
            panning = false;
        }
    }
    
    function handleTouchMove(e) {
        e.stopPropagation(); // Prevent parent elements from scrolling
        
        if (e.touches.length === 1 && panning) {
            // Single touch panning
            e.preventDefault();
            
            pointX = e.touches[0].clientX - startX;
            pointY = e.touches[0].clientY - startY;
            updateTransform();
        } else if (e.touches.length === 2) {
            // Pinch zoom
            e.preventDefault();
            
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            if (lastTouchDistance > 0) {
                // Calculate center point between touches
                const centerX = (touch1.clientX + touch2.clientX) / 2;
                const centerY = (touch1.clientY + touch2.clientY) / 2;
                const rect = img.getBoundingClientRect();
                
                // Calculate zoom amount
                const delta = (currentDistance - lastTouchDistance) * 0.01;
                const newScale = Math.max(1, Math.min(4, scale + delta));
                
                if (newScale !== scale) {
                    // Adjust points to zoom toward pinch center
                    if (newScale > 1) {
                        const zoomPointX = centerX - rect.left;
                        const zoomPointY = centerY - rect.top;
                        pointX = pointX + zoomPointX * (delta / scale);
                        pointY = pointY + zoomPointY * (delta / scale);
                    } else {
                        // Reset position if zooming out to 1
                        pointX = 0;
                        pointY = 0;
                    }
                    
                    scale = newScale;
                    updateTransform();
                }
            }
            
            lastTouchDistance = currentDistance;
        }
    }
    
    function handleTouchEnd(e) {
        // If no more touches, end panning
        if (e.touches.length === 0) {
            panning = false;
        }
        
        // If ending a pinch (going from 2 touches to 1)
        if (e.touches.length === 1 && lastTouchDistance > 0) {
            lastTouchDistance = 0;
            
            // Set up panning with the remaining touch
            if (scale > 1) {
                panning = true;
                startX = e.touches[0].clientX - pointX;
                startY = e.touches[0].clientY - pointY;
            }
        }
    }
    
    // Correct handling of modal backdrop clicks
    modal.onclick = function(e) {
        // Close only if clicking directly on modal background, not on image or controls
        if (e.target.classList.contains('modal-backdrop')) {
            closeImageModal();
        }
    };
    
    // Attach event listeners
    img.addEventListener('dblclick', handleDoubleClick);
    img.addEventListener('wheel', handleWheel);
    img.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Touch events
    img.addEventListener('touchstart', handleTouchStart, { passive: false });
    img.addEventListener('touchmove', handleTouchMove, { passive: false });
    img.addEventListener('touchend', handleTouchEnd);
    
    // Set initial cursor style when zoomed
    if (scale > 1) {
        img.style.cursor = 'grab';
    }
    
    // Store cleanup function for later use
    modal._cleanupFunction = function() {
        img.removeEventListener('dblclick', handleDoubleClick);
        img.removeEventListener('wheel', handleWheel);
        img.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        img.removeEventListener('touchstart', handleTouchStart);
        img.removeEventListener('touchmove', handleTouchMove);
        img.removeEventListener('touchend', handleTouchEnd);
    };
    
    // Cleanup event listeners when modal is hidden
    modal.addEventListener('transitionend', function handler(e) {
        if (e.propertyName === 'opacity' && !modal.classList.contains('visible')) {
            if (typeof modal._cleanupFunction === 'function') {
                modal._cleanupFunction();
                modal._cleanupFunction = null;
            }
            modal.removeEventListener('transitionend', handler);
        }
    });
}

/**
 * Downloads the current modal image
 * @param {Event} event - The event that triggered the download
 */
async function downloadModalImage(event) {
    const modalImg = document.getElementById('modalImage');
    if (!modalImg || !modalImg.src) return;
    
    try {
        // Create a temporary link element to download the image
        const link = document.createElement('a');
        link.href = modalImg.src;
        
        // Extract filename from URL or use a default
        const urlParts = modalImg.src.split('/');
        let filename = urlParts[urlParts.length - 1].split('?')[0];
        
        // Check if we have a valid filename with extension
        if (!filename || filename.indexOf('.') === -1) {
            filename = 'notion-image.jpg';
        }
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error('Error downloading image:', error);
    }
}

// Initialize modal event listeners
function initModalEventListeners() {
    // Initialize the close button
    const closeButton = document.querySelector('.close-button');
    if (closeButton) {
        closeButton.onclick = function(e) {
            e.stopPropagation();
            closeImageModal();
        };
    }
    
    // Initialize the download button
    const modalDownloadButton = document.getElementById('modalDownloadButton');
    if (modalDownloadButton) {
        modalDownloadButton.onclick = function(event) {
            event.preventDefault();
            event.stopPropagation();
            downloadModalImage(event);
        };
    }
}

/**
 * Opens image modal with automatic preview detection from the clicked element
 * @param {HTMLElement} clickedElement - The image element that was clicked
 * @param {string} originalUrl - The original high-resolution image URL
 */
function openImageModalWithPreview(clickedElement, originalUrl) {
    let previewUrl = null;
    
    // Try to get preview URL from the clicked element
    if (clickedElement && clickedElement.tagName === 'IMG') {
        // If the image has a src (already loaded), use it as preview
        if (clickedElement.src && clickedElement.src !== window.location.href) {
            previewUrl = clickedElement.src;
        }
        // If it has data-src and no src, it's still loading, no preview available
    }
    
    // Get the clicked element's position for animation
    let sourceRect = null;
    if (clickedElement) {
        sourceRect = clickedElement.getBoundingClientRect();
    }
    
    // Open modal with the detected preview and source position
    openImageModalWithAnimation(originalUrl, previewUrl, sourceRect);
}

// Global variable to store source position for close animation
let modalSourceRect = null;

/**
 * Opens an image modal with animation from source position
 * @param {string} originalUrl - The URL of the image to display
 * @param {string} previewUrl - Optional preview URL for immediate display
 * @param {DOMRect} sourceRect - The source element's position for animation
 */
function openImageModalWithAnimation(originalUrl, previewUrl = null, sourceRect = null) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    // Store source rect for close animation
    modalSourceRect = sourceRect;
    
    // Reset any existing transforms/state
    resetImageModalState();
    
    // Show the modal immediately
    modal.style.display = "block";
    
    // Clear previous image and set initial state
    modalImg.classList.add('loading');
    modalImg.src = '';
    
    // If we have a preview, show it immediately with animation
    if (previewUrl && previewUrl !== originalUrl) {
        modalImg.src = previewUrl;
        modalImg.classList.remove('loading');
        
        // Set up the initial animation state if we have source position
        if (sourceRect) {
            setupInitialAnimationState(modalImg, sourceRect);
        }
        
        modal.classList.add('visible');
        
        // Animate to final position
        requestAnimationFrame(() => {
            if (sourceRect) {
                animateToFinalPosition(modalImg);
            }
        });
        
        // Add a subtle loading indicator for the high-res version
        addImageLoadingIndicator(modal);
    }
    
    // Preload the original high-resolution image
    const originalImg = new Image();
    originalImg.onload = () => {
        // Calculate optimal dimensions
        modalImg.style.maxWidth = `${Math.min(window.innerWidth * 0.9, originalImg.width)}px`;
        modalImg.style.maxHeight = `${window.innerHeight * 0.9}px`;
        
        // Smooth transition to high-res image
        if (previewUrl && previewUrl !== originalUrl) {
            // Create a smooth transition effect
            modalImg.style.transition = 'opacity 0.3s ease-in-out';
            modalImg.style.opacity = '0.7';
            
            setTimeout(() => {
                modalImg.src = originalUrl;
                modalImg.style.opacity = '1';
                removeImageLoadingIndicator(modal);
            }, 100);
        } else {
            // No preview, show the original with animation
            modalImg.src = originalUrl;
            modalImg.classList.remove('loading');
            
            if (sourceRect) {
                setupInitialAnimationState(modalImg, sourceRect);
            }
            
            modal.classList.add('visible');
            
            // Animate to final position
            requestAnimationFrame(() => {
                if (sourceRect) {
                    animateToFinalPosition(modalImg);
                }
            });
        }
    };
    
    originalImg.onerror = () => {
        modalImg.classList.add('error');
        modalImg.classList.remove('loading');
        removeImageLoadingIndicator(modal);
        
        // If we don't have a preview, set the original URL anyway
        if (!previewUrl) {
            modalImg.src = originalUrl;
            modal.classList.add('visible');
        }
    };
    
    // Start loading original image
    originalImg.src = originalUrl;
    
    // If no preview available, show modal anyway with loading state
    if (!previewUrl) {
        setTimeout(() => {
            modal.classList.add('visible');
        }, 50);
    }
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Initialize zoom and pan variables
    initImageModalControls();
    
    // Add ESC key listener
    document.addEventListener('keydown', handleModalKeyDown);
}

/**
 * Sets up the initial animation state for the modal image
 * @param {HTMLElement} modalImg - The modal image element
 * @param {DOMRect} sourceRect - The source element's position
 */
function setupInitialAnimationState(modalImg, sourceRect) {
    const modal = document.getElementById('imageModal');
    const modalRect = modal.getBoundingClientRect();
    
    // Calculate the scale and position to start from source
    const scaleX = sourceRect.width / (window.innerWidth * 0.8);
    const scaleY = sourceRect.height / (window.innerHeight * 0.8);
    const scale = Math.min(scaleX, scaleY);
    
    const translateX = sourceRect.left + sourceRect.width / 2 - window.innerWidth / 2;
    const translateY = sourceRect.top + sourceRect.height / 2 - window.innerHeight / 2;
    
    // Apply initial transform
    modalImg.style.transition = 'none';
    modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    modalImg.style.opacity = '1';
}

/**
 * Animates the modal image to its final position
 * @param {HTMLElement} modalImg - The modal image element
 */
function animateToFinalPosition(modalImg) {
    modalImg.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    modalImg.style.transform = 'translate(0, 0) scale(1)';
}

/**
 * Animates the modal image back to its source position
 * @param {HTMLElement} modalImg - The modal image element
 * @param {DOMRect} sourceRect - The source element's position
 */
function animateToSourcePosition(modalImg, sourceRect) {
    // Calculate the scale and position to animate back to source
    const scaleX = sourceRect.width / (window.innerWidth * 0.8);
    const scaleY = sourceRect.height / (window.innerHeight * 0.8);
    const scale = Math.min(scaleX, scaleY);
    
    const translateX = sourceRect.left + sourceRect.width / 2 - window.innerWidth / 2;
    const translateY = sourceRect.top + sourceRect.height / 2 - window.innerHeight / 2;
    
    // Apply reverse animation
    modalImg.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';
    modalImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    modalImg.style.opacity = '0';
}

// Functions are globally available 