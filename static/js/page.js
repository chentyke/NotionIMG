// Notion Page Renderer Script
// Main functionality for loading and rendering Notion pages

// Add loading progress tracking
let totalBlocks = 0;
let loadedBlocks = 0;
let parentPageId = null;  // Add variable to store parent page ID

// 添加触摸事件处理，禁止左右滑动
document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault(); // 阻止多点触控
    }
}, { passive: false });

document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault(); // 阻止多点触控导致的滑动
    }
}, { passive: false });

// 阻止默认的左右滑动行为
document.body.style.overflowX = 'hidden';
document.documentElement.style.overflowX = 'hidden';

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

// Compress image with quality parameter
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

// Image modal functions
function openImageModal(originalUrl) {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    // Show the modal first
    modal.style.display = "block";
    
    // Set loading state
    modalImg.classList.add('loading');
    
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
    
    // Initialize zoom and pan variables
    initImageModalControls();
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    
    modal.classList.remove('visible');
    
    // Reset any transforms
    resetImageTransforms();
    
    setTimeout(() => {
        modal.style.display = "none";
        modalImg.classList.remove('loading', 'error');
        modalImg.src = '';
    }, 300);
}

// Initialize image modal zoom and pan controls
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
        e.preventDefault();
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
            e.stopPropagation(); // Prevent closing the modal
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
        e.preventDefault();
        
        if (scale > 1) {
            panning = true;
            startX = e.clientX - pointX;
            startY = e.clientY - pointY;
            
            // Prevent image drag behavior
            img.style.pointerEvents = 'none';
        }
    }
    
    function handleMouseMove(e) {
        e.preventDefault();
        
        if (panning && scale > 1) {
            pointX = e.clientX - startX;
            pointY = e.clientY - startY;
            updateTransform();
        }
    }
    
    function handleMouseUp() {
        panning = false;
        img.style.pointerEvents = 'auto';
    }
    
    // Attach event listeners
    img.addEventListener('dblclick', handleDoubleClick);
    img.addEventListener('wheel', handleWheel);
    img.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    // Touch events for mobile
    let lastTouchDistance = 0;
    
    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            // Single touch - prepare for panning or double-tap
            handleMouseDown({ 
                preventDefault: () => {}, 
                clientX: e.touches[0].clientX, 
                clientY: e.touches[0].clientY 
            });
            
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
        }
    }
    
    function handleTouchMove(e) {
        if (e.touches.length === 1 && scale > 1) {
            // Single touch panning
            e.preventDefault();
            handleMouseMove({ 
                preventDefault: () => {}, 
                clientX: e.touches[0].clientX, 
                clientY: e.touches[0].clientY 
            });
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
    
    function handleTouchEnd() {
        lastTouchDistance = 0;
        handleMouseUp();
    }
    
    // Attach touch event listeners
    img.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    
    // Remove event listeners when modal is closed
    const cleanup = () => {
        img.removeEventListener('dblclick', handleDoubleClick);
        img.removeEventListener('wheel', handleWheel);
        img.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        img.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        
        // Remove this once-only event listener
        modal.removeEventListener('transitionend', cleanup);
    };
    
    modal.addEventListener('transitionend', cleanup, { once: true });
}

// Close modal when pressing Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeImageModal();
    }
});

// Add popstate listener for browser history
window.addEventListener('popstate', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const newPageId = urlParams.get('id');
    if (newPageId) {
        loadPage(newPageId);
    }
});

// Add page transition module
const PageTransition = {
    isTransitioning: false,
    
    // Start a page transition
    start: function(callback) {
        if (this.isTransitioning) return;
        
        this.isTransitioning = true;
        const transition = document.getElementById('pageTransition');
        
        // Save scroll position
        sessionStorage.setItem('lastScrollPos', window.scrollY);
        
        // Reset UI elements
        document.querySelector('.container').classList.remove('loaded');
        const pageCover = document.getElementById('pageCover');
        if (pageCover) {
            pageCover.style.opacity = '0';
        }
        
        // Show transition overlay
        transition.classList.add('active');
        
        // Fade out content
        setTimeout(() => {
            // Reset content
            document.getElementById('pageContent').innerHTML = `
                <div class="flex justify-center py-8">
                    <div class="loading-spinner"></div>
                </div>`;
            
            // Show loading overlay
            const loadingOverlay = document.getElementById('loadingOverlay');
            loadingOverlay.style.display = 'flex';
            loadingOverlay.style.opacity = '1';
            
            // Reset loading progress
            updateLoadingProgress(10);
            
            setTimeout(() => {
                if (callback && typeof callback === 'function') {
                    callback();
                }
            }, 100);
        }, 300);
    },
    
    // Complete a page transition
    complete: function() {
        const transition = document.getElementById('pageTransition');
        
        setTimeout(() => {
            // Hide transition overlay
            transition.classList.remove('active');
            this.isTransitioning = false;
            
            // Reinitialize TOC after transition
            TableOfContents.init();
            TableOfContents.build();
            
            // Restore scroll position if needed
            if (sessionStorage.getItem('lastScrollPos')) {
                setTimeout(() => {
                    window.scrollTo(0, parseInt(sessionStorage.getItem('lastScrollPos') || '0'));
                    sessionStorage.removeItem('lastScrollPos');
                }, 100);
            }
        }, 300);
    }
};

// Load child page with improved transitions
async function loadChildPage(pageId, title) {
    // Start page transition
    PageTransition.start(async () => {
        // Hide TOC during transition
        const tocContainer = document.getElementById('tableOfContents');
        if (tocContainer) {
            tocContainer.classList.remove('visible');
        }
        
        // Update browser history
        window.history.pushState({}, "", `/static/page.html?id=${pageId}`);
        
        // Update page title immediately
        document.title = title;
        document.getElementById('pageTitle').textContent = title;
        
        // Load the new page content
        await loadPage(pageId);
        
        // Complete transition after page is loaded
        PageTransition.complete();
    });
}

// Enhance popstate listener for browser history
window.addEventListener('popstate', (event) => {
    const urlParams = new URLSearchParams(window.location.search);
    const newPageId = urlParams.get('id');
    
    if (newPageId) {
        // Start transition first
        PageTransition.start(async () => {
            await loadPage(newPageId);
            PageTransition.complete();
        });
    }
});

// Optimize block rendering
async function renderBlock(block) {
    loadedBlocks++;
    updateLoadingProgress((loadedBlocks / totalBlocks) * 100);
    
    let content = '';
    const blockColor = block.color && block.color !== 'default' 
        ? block.color.endsWith('_background') 
            ? `bg-${block.color}` 
            : `text-${block.color}`
        : '';

    switch (block.type) {
        case 'paragraph':
            const paragraphText = block.paragraph?.rich_text 
                ? processRichText(block.paragraph.rich_text)
                : '';
            return `<p class="${blockColor}">${paragraphText}</p>`;
        case 'heading_1':
            const h1Text = block.heading_1?.rich_text 
                ? processRichText(block.heading_1.rich_text)
                : '';
            const h1Id = `heading-${block.id || generateHeadingId(h1Text)}`;
            return `<h1 id="${h1Id}" class="${blockColor}">${h1Text}</h1>`;
        case 'heading_2':
            const h2Text = block.heading_2?.rich_text 
                ? processRichText(block.heading_2.rich_text)
                : '';
            const h2Id = `heading-${block.id || generateHeadingId(h2Text)}`;
            return `<h2 id="${h2Id}" class="${blockColor}">${h2Text}</h2>`;
        case 'heading_3':
            const h3Text = block.heading_3?.rich_text 
                ? processRichText(block.heading_3.rich_text)
                : '';
            const h3Id = `heading-${block.id || generateHeadingId(h3Text)}`;
            return `<h3 id="${h3Id}" class="${blockColor}">${h3Text}</h3>`;
        case 'bulleted_list_item':
        case 'numbered_list_item':
            console.log('Processing list item:', block); // 调试日志
            
            // 获取列表项内容
            const listContent = block.content?.rich_text 
                ? processRichText(block.content.rich_text)
                : block.text || '';
            
            let listItemHtml = `<li class="list-item ${blockColor}">`;
            listItemHtml += `<div class="list-item-content">${listContent}</div>`;
            
            // 处理嵌套内容
            if (block.children && block.children.length > 0) {
                const nestedContent = await Promise.all(block.children.map(async child => {
                    // 根据子项类型决定使用哪种列表标签
                    const isNested = child.type === 'bulleted_list_item' || child.type === 'numbered_list_item';
                    const listTag = child.type === 'bulleted_list_item' ? 'ul' : 'ol';
                    
                    const renderedChild = await renderBlock(child);
                    return isNested ? `<${listTag} class="nested-list">${renderedChild}</${listTag}>` : renderedChild;
                }));
                
                if (nestedContent.length > 0) {
                    listItemHtml += `<div class="nested-content">${nestedContent.join('')}</div>`;
                }
            }
            
            listItemHtml += '</li>';
            return listItemHtml;
        case 'code':
            return `<pre><div class="language-label">${block.language || 'text'}</div><button class="copy-button" onclick="copyCode(this)">Copy</button><code class="language-${block.language || 'text'}">${block.text.trim()}</code></pre>`;
        case 'image':
            return `<figure>
                <img class="opacity-0 transition-opacity duration-300" 
                    data-src="${block.image_url}" 
                    alt="${block.caption || 'Page image'}" 
                    onclick="openImageModal('${block.image_url}')"
                    title="Click to view full size">
                ${block.caption ? `<figcaption class="text-sm text-gray-500 mt-1">${block.caption}</figcaption>` : ''}
            </figure>`;
        case 'divider':
            return `<hr class="my-6">`;
        case 'quote':
            return `<blockquote class="${blockColor}">${block.text}</blockquote>`;
        case 'callout':
            return `<div class="bg-gray-50 p-4 rounded-lg my-4 flex items-start" class="${blockColor}">
                <div class="mr-4">${block.icon?.emoji || '💡'}</div>
                <div>${block.text}</div>
            </div>`;
        case 'bookmark':
            const bookmarkData = block.bookmark;
            if (!bookmarkData || !bookmarkData.url) return '';
            
            return `
                <div class="bookmark-block border rounded-lg overflow-hidden my-4 hover:bg-gray-50 transition-colors">
                    <a href="${bookmarkData.url}" target="_blank" rel="noopener noreferrer" 
                       class="block p-4 text-blue-600 hover:text-blue-700">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-link text-gray-400"></i>
                            <div class="flex-1 min-w-0">
                                <div class="text-base font-medium truncate">${bookmarkData.url}</div>
                                ${bookmarkData.caption ? 
                                    `<div class="text-sm text-gray-500 mt-1 truncate">${bookmarkData.caption}</div>` 
                                    : ''}
                            </div>
                            <i class="fas fa-external-link-alt text-gray-400"></i>
                        </div>
                    </a>
                </div>`;
        case 'equation':
            return `<div class="my-4 p-2 bg-gray-50 rounded overflow-x-auto">
                <code>${block.expression}</code>
            </div>`;
        case 'video':
            const videoUrl = block.video_url;
            if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                const videoId = videoUrl.includes('youtu.be') 
                    ? videoUrl.split('/').pop()
                    : new URLSearchParams(new URL(videoUrl).search).get('v');
                return `
                    <div class="aspect-w-16 aspect-h-9 my-4">
                        <iframe src="https://www.youtube.com/embed/${videoId}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>`;
            } else {
                return `<video src="${videoUrl}" controls class="w-full my-4 rounded-lg"></video>`;
            }
        case 'file':
            const fileData = block.file;
            if (!fileData) return '';
            
            // 从 API 响应中获取文件信息
            const fileUrl = fileData.file?.url;
            const fileName = fileData.name || '未命名文件';
            const fileCaption = fileData.caption?.length > 0 
                ? fileData.caption.map(text => text.plain_text || '').join('') 
                : '';
            
            if (!fileUrl) {
                console.error('No file URL found:', fileData);
                return `
                    <div class="file-block border rounded-lg overflow-hidden my-4 bg-secondary">
                        <div class="file-info flex items-center gap-2 p-4">
                            <i class="fas fa-exclamation-circle text-red-500 text-xl"></i>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-primary truncate">文件加载失败</div>
                                <div class="text-sm text-tertiary truncate">无法获取文件链接</div>
                            </div>
                        </div>
                    </div>`;
            }
            
            // 检查文件类型
            const fileExt = fileName.split('.').pop().toLowerCase();
            const isPdf = fileExt === 'pdf';
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
            
            // 根据文件类型返回不同的显示模板
            if (isPdf) {
                return `
                    <div class="file-block pdf-block border rounded-lg overflow-hidden my-4 bg-secondary">
                        <div class="file-preview bg-opacity-50 mb-2">
                            <iframe src="${fileUrl}" class="w-full h-96 rounded-t-lg"></iframe>
                        </div>
                        <div class="file-info flex items-center gap-2 p-4 border-t">
                            <i class="fas fa-file-pdf text-red-500 text-xl"></i>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-primary truncate">${fileName}</div>
                                ${fileCaption ? `<div class="text-sm text-tertiary truncate">${fileCaption}</div>` : ''}
                            </div>
                            <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" download="${fileName}"
                               class="download-button flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                                <i class="fas fa-download"></i>
                                <span>下载</span>
                            </a>
                        </div>
                    </div>`;
            } else if (isImage) {
                return `
                    <div class="file-block image-block border rounded-lg overflow-hidden my-4 bg-secondary">
                        <img src="${fileUrl}" alt="${fileName}" class="w-full rounded-t-lg">
                        <div class="file-info flex items-center gap-2 p-4 border-t">
                            <i class="fas fa-file-image text-blue-500 text-xl"></i>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-primary truncate">${fileName}</div>
                                ${fileCaption ? `<div class="text-sm text-tertiary truncate">${fileCaption}</div>` : ''}
                            </div>
                            <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" download="${fileName}"
                               class="download-button flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                                <i class="fas fa-download"></i>
                                <span>下载</span>
                            </a>
                        </div>
                    </div>`;
            } else {
                return `
                    <div class="file-block border rounded-lg overflow-hidden my-4 bg-secondary">
                        <div class="file-info flex items-center gap-2 p-4">
                            <i class="fas fa-file text-gray-500 text-xl"></i>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-primary truncate">${fileName}</div>
                                ${fileCaption ? `<div class="text-sm text-tertiary truncate">${fileCaption}</div>` : ''}
                            </div>
                            <a href="${fileUrl}" target="_blank" rel="noopener noreferrer" download="${fileName}"
                               class="download-button flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
                                <i class="fas fa-download"></i>
                                <span>下载</span>
                            </a>
                        </div>
                    </div>`;
            }
        case 'pdf':
            return `
                <div class="border rounded-lg p-4 my-4">
                    <iframe src="${block.pdf_url}" class="w-full h-96 rounded-lg"></iframe>
                </div>`;
        case 'embed':
            return `
                <div class="border rounded-lg p-4 my-4">
                    <iframe src="${block.url}" class="w-full h-96 rounded-lg"></iframe>
                </div>`;
        case 'table':
            let tableHtml = `<div class="overflow-x-auto my-4"><table class="min-w-full">`;
            
            // Get table rows from the processed data
            const rows = block.rows || [];
            const hasColumnHeader = block.has_column_header;
            const hasRowHeader = block.has_row_header;
            
            rows.forEach((row, rowIndex) => {
                const cells = row.cells || [];
                const isHeaderRow = hasColumnHeader && rowIndex === 0;
                
                tableHtml += '<tr>';
                cells.forEach((cell, cellIndex) => {
                    const isHeaderCell = isHeaderRow || (hasRowHeader && cellIndex === 0);
                    const tag = isHeaderCell ? 'th' : 'td';
                    // 处理富文本数组
                    const cellContent = Array.isArray(cell) ? processRichText(cell) : cell;
                    tableHtml += `<${tag} class="whitespace-pre-wrap">${cellContent}</${tag}>`;
                });
                tableHtml += '</tr>';
            });
            
            tableHtml += '</table></div>';
            return tableHtml;
        case 'to_do':
            console.log('Todo block:', block); // 调试日志
            try {
                // 处理两种可能的数据格式
                const todoText = block.to_do?.rich_text ? 
                    block.to_do.rich_text.map(text => text.plain_text).join('') : 
                    block.text || 'Untitled todo item';
                    
                const isChecked = block.to_do?.checked || block.checked || false;
                const color = block.to_do?.color || block.color || 'default';
                
                return `
                    <div class="todo-item">
                        <input type="checkbox" ${isChecked ? 'checked' : ''} disabled 
                            class="todo-checkbox">
                        <span class="todo-text ${isChecked ? 'completed' : ''}" 
                            ${color !== 'default' ? 
                                `style="color: ${color === 'gray' ? '#9CA3AF' : color};"` : ''}>
                            ${todoText}
                        </span>
                    </div>`;
            } catch (error) {
                console.error('Error rendering todo item:', error);
                return '<div class="text-red-500">Error rendering todo item</div>';
            }
        case 'child_page':
            return `<div class="border rounded-lg p-4 my-4 hover:bg-gray-50" 
                onclick="loadChildPage('${block.page_id}', '${block.title}')"
                style="cursor: pointer;">
                <div class="flex items-center text-blue-600">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
                        </path>
                    </svg>
                    ${block.title}
                </div>
            </div>`;
        case 'link_preview':
            return `
                <div class="border rounded-lg p-4 my-4 hover:bg-gray-50">
                    <a href="${block.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">
                        ${block.url}
                    </a>
                </div>`;
        case 'synced_block':
            return block.synced_content ? await renderBlock(block.synced_content) : '';
        case 'template':
            return `<div class="text-gray-500 italic my-4">[Template Block]</div>`;
        case 'breadcrumb':
            return `<div class="text-sm text-gray-500 my-4">Navigation Breadcrumb</div>`;
        case 'toggle':
            const toggleId = `toggle-${Math.random().toString(36).substr(2, 9)}`;
            let toggleContent = '';
            
            // Recursively render nested blocks
            if (block.children && block.children.length > 0) {
                console.log('Processing toggle children:', block.children);
                const nestedContent = await Promise.all(block.children.map(async child => {
                    // Handle nested lists
                    if (child.type === 'bulleted_list_item' || child.type === 'numbered_list_item') {
                        const listType = child.type === 'bulleted_list_item' ? 'ul' : 'ol';
                        return `<${listType}>${await renderBlock(child)}</${listType}>`;
                    }
                    return await renderBlock(child);
                }));
                toggleContent = nestedContent.join('');
            }

            return `
                <div class="toggle-block" id="${toggleId}">
                    <div class="toggle-header" onclick="toggleBlock('${toggleId}')" class="${blockColor}">
                        <svg class="toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7"></path>
                        </svg>
                        <div class="toggle-text">${block.text || ''}</div>
                    </div>
                    <div class="toggle-content">
                        <div class="toggle-content-inner prose">
                            ${toggleContent}
                        </div>
                    </div>
                </div>`;
        case 'column_list':
            let columnListHtml = `<div class="column-list" style="--columns: ${block.columns?.length || 2}">`;
            
            if (block.columns && Array.isArray(block.columns)) {
                for (const column of block.columns) {
                    columnListHtml += `<div class="column">`;
                    if (column.children && Array.isArray(column.children)) {
                        for (const childBlock of column.children) {
                            columnListHtml += await renderBlock(childBlock);
                        }
                    }
                    columnListHtml += `</div>`;
                }
            }
            
            columnListHtml += `</div>`;
            return columnListHtml;
        default:
            return '';
    }
}

// Add helper function to generate heading IDs from text
function generateHeadingId(text) {
    // Remove HTML tags if any
    const plainText = text.replace(/<[^>]*>/g, '');
    // Convert to lowercase, replace spaces with hyphens, remove special characters
    return plainText
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]/g, '')
        .replace(/\-+/g, '-')
        .substring(0, 50) + '-' + Math.random().toString(36).substring(2, 7);
}

// Add Table of Contents functionality
const TableOfContents = {
    container: null,
    tocList: null,
    headings: [],
    isCollapsed: false,
    activeHeadingId: null,
    observer: null,
    
    // Initialize the TOC module
    init: function() {
        this.container = document.getElementById('tableOfContents');
        this.tocList = document.getElementById('tocList');
        if (!this.container || !this.tocList) return;
        
        // Set up collapse button
        const collapseBtn = document.getElementById('tocCollapseBtn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => this.toggleCollapse());
        }
        
        // Check if TOC should start collapsed based on user preference
        const tocCollapsed = localStorage.getItem('tocCollapsed');
        if (tocCollapsed === 'true') {
            this.isCollapsed = true;
            this.container.classList.add('collapsed');
        }
        
        // Create intersection observer for headings
        this.setupIntersectionObserver();
    },
    
    // Build the TOC from page headings
    build: function() {
        // Reset state
        this.headings = [];
        this.tocList.innerHTML = '';
        
        // Collect all heading elements
        const pageContent = document.getElementById('pageContent');
        if (!pageContent) return;
        
        // Get all headings
        const h1Elements = pageContent.querySelectorAll('h1');
        const h2Elements = pageContent.querySelectorAll('h2');
        const h3Elements = pageContent.querySelectorAll('h3');
        
        // No headings found, hide TOC
        if (h1Elements.length + h2Elements.length + h3Elements.length === 0) {
            this.container.style.display = 'none';
            return;
        }
        
        // Collect and sort headings
        this.collectHeadings(h1Elements, 1);
        this.collectHeadings(h2Elements, 2);
        this.collectHeadings(h3Elements, 3);
        
        // Sort headings by their position in the document
        this.headings.sort((a, b) => {
            return a.position - b.position;
        });
        
        // Generate TOC HTML
        this.generateTocHtml();
        
        // Show TOC with animation
        this.container.style.display = 'flex';
        setTimeout(() => {
            this.container.classList.add('visible');
        }, 100);
        
        // Start observing headings
        this.observeHeadings();
    },
    
    // Collect headings from the page
    collectHeadings: function(elements, level) {
        elements.forEach(element => {
            // Get text and ID
            const text = element.textContent.trim();
            let id = element.id;
            
            // If no ID exists, create one
            if (!id) {
                id = `heading-${generateHeadingId(text)}`;
                element.id = id;
            }
            
            // Calculate position in document
            const position = element.getBoundingClientRect().top + window.scrollY;
            
            // Add to headings array
            this.headings.push({
                id,
                text,
                level,
                position
            });
            
            // Set up intersection observer for this heading
            if (this.observer) {
                this.observer.observe(element);
            }
        });
    },
    
    // Generate the HTML for the TOC
    generateTocHtml: function() {
        this.headings.forEach(heading => {
            const li = document.createElement('li');
            li.className = `toc-item toc-level-${heading.level}`;
            
            const a = document.createElement('a');
            a.href = `#${heading.id}`;
            a.className = 'toc-link';
            a.dataset.id = heading.id;
            
            // Add indicator dot for level 2 and 3
            if (heading.level > 1) {
                const indicator = document.createElement('span');
                indicator.className = 'toc-indicator';
                a.appendChild(indicator);
            }
            
            a.appendChild(document.createTextNode(heading.text));
            
            // Add click event to scroll to section
            a.addEventListener('click', (e) => {
                e.preventDefault();
                this.scrollToHeading(heading.id);
            });
            
            li.appendChild(a);
            this.tocList.appendChild(li);
        });
    },
    
    // Scroll to a heading with smooth animation
    scrollToHeading: function(id) {
        const element = document.getElementById(id);
        if (!element) return;
        
        // Get the heading's position
        const elementPosition = element.getBoundingClientRect().top + window.scrollY;
        
        // Account for fixed header height if needed
        const headerOffset = 80; // Adjust based on your header height
        const offsetPosition = elementPosition - headerOffset;
        
        // Smoothly scroll to the heading
        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
        
        // Update active heading
        this.setActiveHeading(id);
        
        // Update URL hash without triggering scroll
        history.replaceState(null, null, `#${id}`);
    },
    
    // Set up intersection observer for headings
    setupIntersectionObserver: function() {
        // Create options for the observer
        const options = {
            root: null, // Use viewport as root
            rootMargin: '-80px 0px -70% 0px', // Top offset for header, bottom margin to trigger earlier
            threshold: 0 // Trigger as soon as any part of the element is visible
        };
        
        // Create the observer
        this.observer = new IntersectionObserver(entries => {
            let visibleHeadings = entries
                .filter(entry => entry.isIntersecting)
                .map(entry => ({
                    id: entry.target.id,
                    position: entry.boundingClientRect.top
                }));
            
            if (visibleHeadings.length > 0) {
                // Find the heading closest to the top
                visibleHeadings.sort((a, b) => Math.abs(a.position) - Math.abs(b.position));
                this.setActiveHeading(visibleHeadings[0].id);
            }
        }, options);
    },
    
    // Start observing all headings
    observeHeadings: function() {
        if (!this.observer) return;
        
        // Disconnect previous observations
        this.observer.disconnect();
        
        // Observe each heading
        this.headings.forEach(heading => {
            const element = document.getElementById(heading.id);
            if (element) {
                this.observer.observe(element);
            }
        });
    },
    
    // Set active heading in TOC
    setActiveHeading: function(id) {
        if (this.activeHeadingId === id) return;
        
        // Update active state
        this.activeHeadingId = id;
        
        // Remove active class from all links
        const links = this.tocList.querySelectorAll('.toc-link');
        links.forEach(link => link.classList.remove('active'));
        
        // Add active class to current link
        const activeLink = this.tocList.querySelector(`.toc-link[data-id="${id}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
            
            // Scroll active item into view within TOC if needed
            this.scrollActiveIntoView(activeLink);
        }
    },
    
    // Scroll active item into view within TOC content
    scrollActiveIntoView: function(activeLink) {
        if (!activeLink || this.isCollapsed) return;
        
        const tocContent = document.querySelector('.toc-content');
        if (!tocContent) return;
        
        const linkRect = activeLink.getBoundingClientRect();
        const contentRect = tocContent.getBoundingClientRect();
        
        // Check if the active link is outside the visible area
        if (linkRect.top < contentRect.top || linkRect.bottom > contentRect.bottom) {
            activeLink.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    },
    
    // Toggle collapse state
    toggleCollapse: function() {
        this.isCollapsed = !this.isCollapsed;
        
        if (this.isCollapsed) {
            this.container.classList.add('collapsed');
            // Update button title and icon
            const collapseBtn = document.getElementById('tocCollapseBtn');
            if (collapseBtn) {
                collapseBtn.title = '展开目录';
                collapseBtn.setAttribute('aria-label', '展开目录');
                const icon = collapseBtn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-chevron-right';
                }
            }
        } else {
            this.container.classList.remove('collapsed');
            // Update button title and icon
            const collapseBtn = document.getElementById('tocCollapseBtn');
            if (collapseBtn) {
                collapseBtn.title = '收起目录';
                collapseBtn.setAttribute('aria-label', '收起目录');
                const icon = collapseBtn.querySelector('i');
                if (icon) {
                    icon.className = 'fas fa-chevron-left';
                }
            }
        }
        
        // Save preference
        localStorage.setItem('tocCollapsed', this.isCollapsed);
    }
};

// Update loadPage function to initialize TOC after content is loaded
async function loadPage(pageId = null) {
    const urlParams = new URLSearchParams(window.location.search);
    const targetPageId = pageId || urlParams.get('id');
    
    if (!targetPageId) {
        document.getElementById('pageContent').innerHTML = `
            <div class="text-center text-red-500">
                <p>No page ID provided.</p>
            </div>`;
        return;
    }

    try {
        // Reset page state
        const container = document.querySelector('.container');
        const pageCover = document.getElementById('pageCover');
        const backButton = document.querySelector('.mt-8');
        const loadingText = document.querySelector('.loading-text');
        
        // Hide container and back button
        container.classList.remove('loaded');
        if (backButton) {
            backButton.style.display = 'none';
            backButton.classList.remove('visible');
        }
        
        // Reset cover
        if (pageCover) {
            pageCover.style.display = 'none';
            pageCover.classList.remove('loaded');
            const coverImg = pageCover.querySelector('img');
            if (coverImg) {
                coverImg.src = '';
            }
        }
        
        // Start loading data
        updateLoadingProgress(10);
        loadingText.textContent = '正在获取页面数据...';
        const response = await fetch(`/page/${targetPageId}`);
        
        // Check for errors
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        updateLoadingProgress(30);
        loadingText.textContent = '正在处理页面内容...';
        
        // Update page title and date
        if (data.page && data.page.title) {
            document.title = data.page.title;
            updatePageTitle(data.page.title);
        }
        
        // Handle cover image
        if (data.page && data.page.cover && pageCover) {
            loadingText.textContent = '正在加载封面图片...';
            const coverImg = pageCover.querySelector('img');
            let coverUrl = '';
            
            if (data.page.cover.type === 'external') {
                coverUrl = data.page.cover.external.url;
            } else if (data.page.cover.type === 'file') {
                coverUrl = data.page.cover.file.url;
            }
            
            if (coverUrl && coverImg) {
                try {
                    await new Promise((resolve, reject) => {
                        const img = new Image();
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = coverUrl;
                        
                        // Set timeout to avoid hanging
                        const timeout = setTimeout(() => {
                            img.src = '';
                            reject(new Error('Cover image load timeout'));
                        }, 10000);
                        
                        img.onload = () => {
                            clearTimeout(timeout);
                            resolve();
                        };
                    });
                    
                    // Display cover with animation
                    coverImg.src = coverUrl;
                    pageCover.style.display = 'block';
                    setTimeout(() => {
                        pageCover.classList.add('loaded');
                        coverImg.style.opacity = '1';
                    }, 50);
                } catch (error) {
                    console.error('Failed to load cover image:', error);
                    pageCover.style.display = 'none';
                }
            }
        }
        
        // Update back button based on parent page and show_back property
        const backButtonContainer = document.querySelector('.mt-8');
        if (data.page.show_back === false) {
            backButtonContainer.style.display = 'none';
        } else {
            backButtonContainer.style.display = 'block';
            const backButton = document.querySelector('.back-button');
            if (data.page.parent_id) {
                parentPageId = data.page.parent_id;
                try {
                    const parentResponse = await fetch(`/page/${parentPageId}`);
                    const parentData = await parentResponse.json();
                    const parentTitle = parentData.page.title;
                    backButton.href = `/static/page.html?id=${parentPageId}`;
                    backButton.innerHTML = `
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        返回上级：${parentTitle}
                    `;
                } catch (error) {
                    console.error('Error fetching parent page:', error);
                    backButton.href = `/static/page.html?id=${parentPageId}`;
                    backButton.innerHTML = `
                        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        返回上级页面
                    `;
                }
            } else {
                parentPageId = null;
                backButton.href = "/static/pages.html";
                backButton.innerHTML = `
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                    </svg>
                    返回页面列表
                `;
            }
            // Show back button with animation after content is loaded
            setTimeout(() => {
                backButtonContainer.classList.add('visible');
            }, 300);
        }
        
        updateLoadingProgress(50);
        loadingText.textContent = '正在渲染页面内容...';
        
        // Initialize block counting
        totalBlocks = data.blocks.length;
        loadedBlocks = 0;
        
        // Render content
        let content = '';
        let currentList = null;
        
        for (const block of data.blocks) {
            if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
                if (!currentList || currentList.type !== block.type) {
                    if (currentList) {
                        content += `</${currentList.tag}>`;
                    }
                    currentList = {
                        type: block.type,
                        tag: block.type === 'bulleted_list_item' ? 'ul' : 'ol'
                    };
                    content += `<${currentList.tag} class="${block.type === 'bulleted_list_item' ? 'list-disc' : 'list-decimal'} ml-6">`;
                }
                content += await renderBlock(block);
            } else {
                if (currentList) {
                    content += `</${currentList.tag}>`;
                    currentList = null;
                }
                content += await renderBlock(block);
            }
        }
        
        if (currentList) {
            content += `</${currentList.tag}>`;
        }
        
        document.getElementById('pageContent').innerHTML = content;
        
        // Initialize lazy loading for images
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
        
        // Initialize TOC after content is rendered
        TableOfContents.init();
        TableOfContents.build();
        
        // Show container with animation when everything is loaded
        updateLoadingProgress(90);
        loadingText.textContent = '优化显示效果...';
        
        setTimeout(() => {
            container.classList.add('loaded');
            updateLoadingProgress(100);
        }, 300);
        
    } catch (error) {
        console.error('Error loading page content:', error);
        document.getElementById('pageContent').innerHTML = `
            <div class="text-center text-red-500">
                <p>Error loading page content.</p>
                <p class="text-sm mt-2">${error.message}</p>
                <button onclick="window.location.reload()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                    重新加载
                </button>
            </div>`;
        
        // Update loading state
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = '加载失败，请重试...';
        }
        updateLoadingProgress(100);
        
        // Hide loading overlay
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('fade-out');
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    loadingOverlay.classList.remove('fade-out');
                }, 500);
            }
            
            // Show container even on error to display error message
            document.querySelector('.container').classList.add('loaded');
        }, 1000);
        
        // Complete page transition if was transitioning
        if (PageTransition.isTransitioning) {
            PageTransition.complete();
        }
    }
}

// Add toggle block function
function toggleBlock(id) {
    const block = document.getElementById(id);
    if (!block) {
        console.error(`Toggle block with id ${id} not found`);
        return;
    }
    
    const content = block.querySelector('.toggle-content');
    const contentInner = content.querySelector('.toggle-content-inner');
    const toggleIcon = block.querySelector('.toggle-icon');
    
    if (!content || !contentInner) {
        console.error(`Toggle block ${id} is missing required elements`);
        return;
    }
    
    const isOpen = block.classList.contains('open');
    
    // Get the current height before any changes
    const startHeight = content.offsetHeight;
    
    if (isOpen) {
        // Set explicit height before closing
        content.style.height = startHeight + 'px';
        // Force reflow
        content.offsetHeight;
        
        // Start closing animation with proper easing
        block.classList.remove('open');
        toggleIcon.style.transform = 'rotate(0deg)';
        
        requestAnimationFrame(() => {
            content.style.height = '0';
            content.style.opacity = '0';
        });
    } else {
        // Start opening animation
        block.classList.add('open');
        
        // Animate the icon rotation with proper easing
        toggleIcon.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        toggleIcon.style.transform = 'rotate(90deg)';
        
        const targetHeight = contentInner.offsetHeight;
        content.style.height = '0';
        
        // Force reflow
        content.offsetHeight;
        
        // Trigger animation with proper easing
        requestAnimationFrame(() => {
            content.style.transition = 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            content.style.height = targetHeight + 'px';
            content.style.opacity = '1';
        });
        
        // Reset height after animation
        content.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'height' && block.classList.contains('open')) {
                content.style.height = 'auto';
                content.removeEventListener('transitionend', handler);
                
                // Check if content needs to be expanded further after render
                setTimeout(() => {
                    const newHeight = contentInner.offsetHeight;
                    if (Math.abs(newHeight - targetHeight) > 5) {
                        content.style.height = newHeight + 'px';
                    }
                }, 100);
            }
        });
    }
}

// Add copy code function
function copyCode(button) {
    const pre = button.parentElement;
    const code = pre.querySelector('code');
    const text = code.textContent;
    
    if (!text.trim()) {
        button.textContent = 'Empty';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('copied');
        }, 2000);
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        button.textContent = 'Copied!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = 'Copy';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text:', err);
        button.textContent = 'Failed';
        
        setTimeout(() => {
            button.textContent = 'Copy';
        }, 2000);
    });
}

function copyPageLink() {
    const currentUrl = window.location.href;
    const buttons = document.querySelectorAll('.copy-link-button');
    
    navigator.clipboard.writeText(currentUrl).then(() => {
        buttons.forEach(button => {
            button.classList.add('copied');
            // 保存原始内容
            const originalContent = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            if (!button.classList.contains('floating-header')) {
                button.innerHTML += '<span>复制成功</span>';
            }
            
            setTimeout(() => {
                button.classList.remove('copied');
                // 根据按钮位置恢复不同的内容
                if (button.closest('.floating-header')) {
                    button.innerHTML = '<i class="fas fa-link"></i>';
                } else {
                    button.innerHTML = '<i class="fas fa-link"></i><span>复制链接</span>';
                }
            }, 2000);
        });
    }).catch(err => {
        console.error('Failed to copy link:', err);
        buttons.forEach(button => {
            // 保存原始内容
            const originalContent = button.innerHTML;
            button.innerHTML = '<i class="fas fa-times"></i>';
            if (!button.classList.contains('floating-header')) {
                button.innerHTML += '<span>复制失败</span>';
            }
            
            setTimeout(() => {
                // 根据按钮位置恢复不同的内容
                if (button.closest('.floating-header')) {
                    button.innerHTML = '<i class="fas fa-link"></i>';
                } else {
                    button.innerHTML = '<i class="fas fa-link"></i><span>复制链接</span>';
                }
            }, 2000);
        });
    });
}

// 修改滚动监听逻辑
let lastScrollTop = 0;
let scrollTimeout = null;
let floatingHeader, mainHeader, floatingTitle;
const showThreshold = 10; // 显示阈值
const hideThreshold = 30; // 隐藏阈值
const hideDelay = 150; // 隐藏延迟

// Initialize UI controls after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    floatingHeader = document.getElementById('floatingHeader');
    mainHeader = document.querySelector('.page-header');
    floatingTitle = document.getElementById('floatingTitle');
    
    // Initialize Table of Contents
    TableOfContents.init();
    
    // Set up scroll event listener
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const headerRect = mainHeader.getBoundingClientRect();
        const scrollDelta = Math.abs(scrollTop - lastScrollTop);
        const scrollDirection = scrollTop > lastScrollTop ? 'down' : 'up';
        
        // 清除之前的定时器
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
            scrollTimeout = null;
        }
        
        // 当主标题完全离开视口时才考虑显示/隐藏
        if (headerRect.bottom < 0) {
            if (scrollDirection === 'up' && scrollDelta > showThreshold) {
                // 向上滚动且超过显示阈值时，立即显示
                floatingHeader.classList.add('visible');
            } else if (scrollDirection === 'down' && scrollDelta > hideThreshold) {
                // 向下滚动且超过隐藏阈值时，立即隐藏
                floatingHeader.classList.remove('visible');
            }
        } else {
            // 当主标题在视口内时，立即隐藏
            floatingHeader.classList.remove('visible');
        }
        
        // 更新滚动位置
        lastScrollTop = scrollTop;
    });
    
    // Initial check on page load
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const headerRect = mainHeader.getBoundingClientRect();
    
    // 如果页面加载时主标题已经不在视口内，且滚动位置不在顶部，则显示浮动标题
    if (headerRect.bottom < 0 && scrollTop > 0) {
        floatingHeader.classList.add('visible');
    }
    
    // Get page ID from URL and load page if present
    const urlParams = new URLSearchParams(window.location.search);
    const pageId = urlParams.get('id');
    
    // 如果没有页面 ID，尝试从路径中获取 suffix
    if (!pageId) {
        const suffix = window.location.pathname.substring(1);
        if (suffix) {
            // 获取具有该 suffix 的页面
            fetch(`/api/pages?suffix=${suffix}`)
                .then(response => response.json())
                .then(pages => {
                    if (pages && pages.length === 1) {
                        // 如果只有一个页面，直接加载该页面
                        const pageId = pages[0].id;
                        loadPage(pageId);
                    }
                })
                .catch(error => {
                    console.error('Error loading page by suffix:', error);
                    showError('Error loading page');
                });
        }
    } else {
        loadPage(pageId);
    }
});

// 更新页面标题时同时更新浮动标题
const updatePageTitle = (title) => {
    document.title = title;
    document.getElementById('pageTitle').textContent = title;
    floatingTitle.textContent = title;
};

// 处理富文本内容
function processRichText(richTextArray) {
    if (!richTextArray || !Array.isArray(richTextArray)) {
        return '';
    }

    return richTextArray.map(textObj => {
        if (!textObj || !textObj.text) {
            return '';
        }

        const { text, annotations = {}, type } = textObj;
        const content = text.content || '';
        const link = text.link;

        // 处理注释样式
        let classes = [];
        let styles = [];

        // 处理颜色
        if (annotations.color && annotations.color !== 'default') {
            if (annotations.color.endsWith('_background')) {
                classes.push(`bg-${annotations.color}`);
            } else {
                classes.push(`text-${annotations.color}`);
            }
        }

        // 处理其他注释
        if (annotations.bold) classes.push('font-bold');
        if (annotations.italic) classes.push('italic');
        if (annotations.strikethrough) classes.push('line-through');
        if (annotations.underline) classes.push('underline');
        if (annotations.code) classes.push('font-mono bg-gray-100 px-1 rounded');

        // 构建HTML
        let html = `<span class="rich-text-wrapper ${classes.join(' ')}"`;
        if (styles.length > 0) {
            html += ` style="${styles.join('; ')}"`;
        }
        html += '>';

        // 处理链接
        if (link) {
            html += `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">`;
        }

        html += content;

        if (link) {
            html += '</a>';
        }

        html += '</span>';
        return html;
    }).join('');
}

// Add download function
async function downloadModalImage(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const modalImage = document.getElementById('modalImage');
    const imageUrl = modalImage.src;
    const downloadButton = document.getElementById('modalDownloadButton');
    
    try {
        // 禁用按钮并显示加载状态
        downloadButton.disabled = true;
        const originalContent = downloadButton.innerHTML;
        downloadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>下载中...</span>';
        
        // 检查是否为移动设备
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile) {
            // 移动端：直接打开新窗口下载
            window.open(imageUrl, '_blank');
            
            // 更新按钮状态
            downloadButton.innerHTML = '<i class="fas fa-check"></i><span>已打开下载</span>';
            setTimeout(() => {
                downloadButton.disabled = false;
                downloadButton.innerHTML = originalContent;
            }, 2000);
            return;
        }
        
        // PC端：使用 Blob 下载
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('Failed to fetch image');
        
        // 从 Content-Type 获取正确的文件类型
        const contentType = response.headers.get('content-type');
        let extension = 'jpg'; // 默认扩展名
        
        // 根据 Content-Type 设置正确的扩展名
        if (contentType) {
            if (contentType.includes('png')) extension = 'png';
            else if (contentType.includes('gif')) extension = 'gif';
            else if (contentType.includes('webp')) extension = 'webp';
            else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
            else if (contentType.includes('heic')) extension = 'heic';
        }
        
        // 从 URL 中提取原始文件名和扩展名（如果存在）
        let filename = 'image';
        try {
            const urlParts = imageUrl.split('/');
            const originalFilename = urlParts[urlParts.length - 1].split('?')[0]; // 移除查询参数
            if (originalFilename) {
                // 检查 URL 中是否包含 .heic 扩展名
                if (originalFilename.toLowerCase().includes('.heic')) {
                    extension = 'heic';
                }
                // 获取文件名（不含扩展名）
                filename = originalFilename.split('.')[0];
            }
        } catch (e) {
            console.warn('Could not extract filename from URL:', e);
        }
        
        const blob = await response.blob();
        // 保持原始 Content-Type
        const newBlob = new Blob([blob], { type: contentType || `image/${extension}` });
        const blobUrl = window.URL.createObjectURL(newBlob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${filename}.${extension}`; // 使用提取的文件名和正确的扩展名
        document.body.appendChild(link);
        link.click();
        
        // 清理
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        
        // 显示成功状态
        downloadButton.innerHTML = '<i class="fas fa-check"></i><span>下载成功</span>';
        setTimeout(() => {
            downloadButton.disabled = false;
            downloadButton.innerHTML = originalContent;
        }, 2000);
        
    } catch (error) {
        console.error('Download failed:', error);
        // 显示更详细的错误信息
        const errorMessage = error.message || '未知错误';
        downloadButton.innerHTML = `<i class="fas fa-exclamation-circle"></i><span>下载失败</span>`;
        console.log('下载错误详情:', errorMessage);
        
        setTimeout(() => {
            downloadButton.disabled = false;
            downloadButton.innerHTML = originalContent;
        }, 2000);
    }
}

// Add page transition function
async function transitionToPage(pageId, title) {
    // Show transition overlay
    const transition = document.getElementById('pageTransition');
    transition.classList.add('active');
    
    // Show loading overlay with initial state
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = loadingOverlay.querySelector('.loading-text');
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
    loadingText.textContent = '正在加载页面内容...';
    
    // Update URL without reloading
    window.history.pushState({}, "", `/static/page.html?id=${pageId}`);
    
    try {
        // Start loading the new page
        await loadPage(pageId);
        
        // Hide transition overlay
        setTimeout(() => {
            transition.classList.remove('active');
        }, 300);
    } catch (error) {
        console.error('Error during page transition:', error);
        loadingText.textContent = '加载失败，请重试...';
    }
} 