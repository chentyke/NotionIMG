// Image Modal functionality

/**
 * Opens an image modal with the specified image URL
 * @param {string} originalUrl - The URL of the image to display
 */
function openImageModal(originalUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    // Reset any existing transforms/state
    resetImageModalState();
    
    // Show the modal first
    modal.style.display = "block";
    
    // Set loading state
    modalImg.classList.add('loading');
    modalImg.src = ''; // Clear previous image
    
    // Preload the image
    const img = new Image();
    img.onload = () => {
        modalImg.src = originalUrl;
        modalImg.style.maxWidth = `${Math.min(window.innerWidth * 0.9, img.width)}px`;
        
        // Calculate optimal height constraint (90% of viewport height)
        modalImg.style.maxHeight = `${window.innerHeight * 0.9}px`;
        
        // Once image is set, show it with animation
        setTimeout(() => {
            modalImg.classList.remove('loading');
            // Force reflow
            modal.offsetHeight;
            modal.classList.add('visible');
        }, 50);
    };
    
    img.onerror = () => {
        modalImg.src = originalUrl;
        modalImg.classList.add('error');
        
        // Show error state
        setTimeout(() => {
            modalImg.classList.remove('loading');
            // Force reflow
            modal.offsetHeight;
            modal.classList.add('visible');
        }, 50);
    };
    
    // Start loading
    img.src = originalUrl;
    
    // Prevent scrolling on the body
    document.body.style.overflow = 'hidden';
    
    // Initialize zoom and pan variables
    initImageModalControls();
    
    // Add ESC key listener
    document.addEventListener('keydown', handleModalKeyDown);
}

/**
 * Closes the image modal
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
    
    // Immediately hide the buttons to sync with image fading
    if (closeButton) closeButton.style.opacity = '0';
    if (downloadButton) downloadButton.style.opacity = '0';
    
    modal.classList.remove('visible');
    
    // Reset any transforms
    resetImageModalState();
    
    // Remove ESC key listener
    document.removeEventListener('keydown', handleModalKeyDown);
    
    // Re-enable scrolling on the body
    document.body.style.overflow = '';
    
    setTimeout(() => {
        modal.style.display = "none";
        modalImg.classList.remove('loading', 'error');
        modalImg.src = '';
        // Reset opacity for next opening
        if (closeButton) closeButton.style.opacity = '';
        if (downloadButton) downloadButton.style.opacity = '';
    }, 300);
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

// Export functions
export {
    openImageModal,
    closeImageModal,
    handleModalKeyDown,
    resetImageModalState,
    initImageModalControls,
    downloadModalImage,
    initModalEventListeners
}; 