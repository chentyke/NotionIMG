// Main entry point for Notion page renderer
import * as Core from './core.js';
import * as Loader from './loader.js';
import * as ImageHandler from './imageHandler.js';
import * as Modal from './modal.js';
import * as Utils from './utils.js';
import * as NotionRenderer from './notionRenderer.js';

// Floating header management
let floatingHeaderVisible = false;
let lastScrollTop = 0;

// Floating TOC management
let floatingTocVisible = false;
let floatingTocHeadings = [];
let currentActiveHeading = null;

/**
 * Initialize floating header scroll behavior
 */
function initFloatingHeader() {
    const floatingHeader = document.getElementById('floatingHeader');
    const floatingTitle = document.getElementById('floatingTitle');
    const floatingBreadcrumb = document.getElementById('floatingBreadcrumb');
    const pageTitle = document.getElementById('pageTitle');
    
    if (!floatingHeader || !floatingTitle) return;
    
    // Update floating title when page title changes
    const updateFloatingTitle = () => {
        if (pageTitle && pageTitle.textContent) {
            floatingTitle.textContent = pageTitle.textContent;
        }
    };
    
    // Update breadcrumb based on current heading
    const updateBreadcrumb = () => {
        if (!floatingBreadcrumb) return;
        
        if (floatingTocHeadings.length === 0) {
            // 没有标题时，隐藏面包屑
            floatingBreadcrumb.style.display = 'none';
            floatingHeader.style.cursor = 'default';
            floatingHeader.removeAttribute('title');
            floatingHeader.removeAttribute('aria-label');
        } else {
            // 有标题时，显示面包屑和启用点击
            floatingBreadcrumb.style.display = 'block';
            floatingHeader.style.cursor = 'pointer';
            floatingHeader.setAttribute('title', '点击查看目录');
            floatingHeader.setAttribute('aria-label', '点击查看目录');
            
            if (currentActiveHeading) {
                const heading = floatingTocHeadings.find(h => h.id === currentActiveHeading);
                if (heading) {
                    // 构建面包屑路径
                    const breadcrumbPath = buildBreadcrumbPath(heading);
                    floatingBreadcrumb.innerHTML = breadcrumbPath;
                }
            } else {
                floatingBreadcrumb.innerHTML = '<span class="breadcrumb-separator">/</span><span style="color: var(--text-tertiary);">选择章节...</span>';
            }
        }
    };
    
    // Initial update
    updateFloatingTitle();
    
    // Watch for page title changes
    const observer = new MutationObserver(() => {
        updateFloatingTitle();
        // 延迟更新面包屑，确保TOC已初始化
        setTimeout(updateBreadcrumb, 100);
    });
    if (pageTitle) {
        observer.observe(pageTitle, { childList: true, characterData: true, subtree: true });
    }
    
    // Scroll event handler
    const handleScroll = () => {
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const pageHeader = document.querySelector('.page-header');
        
        if (pageHeader) {
            const headerRect = pageHeader.getBoundingClientRect();
            const shouldShow = headerRect.bottom < 0; // Header is completely scrolled out of view
            
            if (shouldShow && !floatingHeaderVisible) {
                floatingHeader.classList.add('visible');
                floatingHeaderVisible = true;
                updateBreadcrumb(); // 显示时更新面包屑
            } else if (!shouldShow && floatingHeaderVisible) {
                floatingHeader.classList.remove('visible');
                floatingHeaderVisible = false;
                hideFloatingToc(); // 隐藏时关闭目录
            }
        }
        
        lastScrollTop = currentScrollTop;
    };
    
    // Add scroll listener with throttling
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(handleScroll, 10);
    }, { passive: true });
    
    // Initial check
    setTimeout(() => {
        handleScroll();
        updateBreadcrumb();
    }, 100);
}

/**
 * Build breadcrumb path for current heading
 */
function buildBreadcrumbPath(currentHeading) {
    if (!currentHeading) return '';
    
    // 简化面包屑显示，只显示当前标题
    const separator = '<span class="breadcrumb-separator">/</span>';
    const levelIndicator = currentHeading.level === 1 ? '章节' : 
                          currentHeading.level === 2 ? '小节' : '段落';
    
    return `${separator}<span style="color: var(--text-secondary); font-size: 0.75rem;">${levelIndicator}</span>${separator}<span style="color: var(--primary-color);">${currentHeading.text.length > 20 ? currentHeading.text.substring(0, 20) + '...' : currentHeading.text}</span>`;
}

/**
 * Initialize floating TOC functionality
 */
function initFloatingToc() {
    floatingTocHeadings = [];
    currentActiveHeading = null;
    
    // Collect all headings (h1, h2, h3) from the page content
    const pageContent = document.getElementById('pageContent');
    if (!pageContent) return;
    
    const headings = pageContent.querySelectorAll('h1, h2, h3');
    headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.charAt(1));
        const text = heading.textContent.trim();
        let id = heading.id;
        
        // Generate ID if not exists
        if (!id) {
            id = `heading-${index}`;
            heading.id = id;
        }
        
        floatingTocHeadings.push({ level, text, id });
    });
    
    // Build floating TOC HTML
    buildFloatingToc();
    
    // Update scroll spy
    updateFloatingTocScrollSpy();
}

/**
 * Build floating TOC HTML structure
 */
function buildFloatingToc() {
    const floatingTocList = document.getElementById('floatingTocList');
    if (!floatingTocList) return;
    
    if (floatingTocHeadings.length === 0) {
        floatingTocList.innerHTML = '<li><p style="text-align: center; color: var(--text-tertiary); padding: 20px;">此页面没有标题</p></li>';
        return;
    }
    
    let html = '';
    floatingTocHeadings.forEach(heading => {
        html += `
            <li>
                <a href="#${heading.id}" class="level-${heading.level}" onclick="scrollToHeading('${heading.id}'); return false;">
                    ${heading.text}
                </a>
            </li>
        `;
    });
    
    floatingTocList.innerHTML = html;
}

/**
 * Update floating TOC scroll spy to highlight current section
 */
function updateFloatingTocScrollSpy() {
    if (floatingTocHeadings.length === 0) return;
    
    const handleScrollSpy = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let newActiveHeading = null;
        
        // Find the current heading based on scroll position
        for (let i = floatingTocHeadings.length - 1; i >= 0; i--) {
            const heading = document.getElementById(floatingTocHeadings[i].id);
            if (heading) {
                const headingTop = heading.getBoundingClientRect().top + scrollTop;
                if (scrollTop >= headingTop - 150) {
                    newActiveHeading = floatingTocHeadings[i].id;
                    break;
                }
            }
        }
        
        // Update active states only if changed
        if (newActiveHeading !== currentActiveHeading) {
            currentActiveHeading = newActiveHeading;
            
            // Update active states in TOC
            const tocLinks = document.querySelectorAll('#floatingTocList a');
            tocLinks.forEach(link => {
                if (currentActiveHeading && link.getAttribute('href') === `#${currentActiveHeading}`) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
            
            // Update breadcrumb if floating header is visible
            if (floatingHeaderVisible) {
                const floatingBreadcrumb = document.getElementById('floatingBreadcrumb');
                if (floatingBreadcrumb && currentActiveHeading) {
                    const heading = floatingTocHeadings.find(h => h.id === currentActiveHeading);
                    if (heading) {
                        const breadcrumbPath = buildBreadcrumbPath(heading);
                        floatingBreadcrumb.innerHTML = breadcrumbPath;
                    }
                }
            }
        }
    };
    
    // Add scroll listener for scroll spy
    let spyTimeout;
    window.addEventListener('scroll', () => {
        if (spyTimeout) {
            clearTimeout(spyTimeout);
        }
        spyTimeout = setTimeout(handleScrollSpy, 50);
    }, { passive: true });
    
    // Initial check
    setTimeout(handleScrollSpy, 100);
}

/**
 * Toggle floating TOC visibility
 */
function toggleFloatingToc() {
    // 如果没有标题，不显示目录
    if (floatingTocHeadings.length === 0) {
        return;
    }
    
    const floatingToc = document.getElementById('floatingToc');
    if (!floatingToc) return;
    
    if (floatingTocVisible) {
        hideFloatingToc();
    } else {
        showFloatingToc();
    }
}

/**
 * Show floating TOC
 */
function showFloatingToc() {
    const floatingToc = document.getElementById('floatingToc');
    if (!floatingToc) return;
    
    // 禁用页面滚动
    document.body.style.overflow = 'hidden';
    
    floatingToc.classList.add('visible');
    floatingTocVisible = true;
    
    // 添加键盘事件监听
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            hideFloatingToc();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
}

/**
 * Hide floating TOC
 */
function hideFloatingToc() {
    const floatingToc = document.getElementById('floatingToc');
    if (!floatingToc) return;
    
    // 恢复页面滚动
    document.body.style.overflow = '';
    
    floatingToc.classList.remove('visible');
    floatingTocVisible = false;
}

/**
 * Scroll to specific heading
 */
function scrollToHeading(headingId) {
    const heading = document.getElementById(headingId);
    if (heading) {
        // 先隐藏目录
        hideFloatingToc();
        
        // 延迟滚动，让目录动画完成
        setTimeout(() => {
            const offset = 120; // Account for floating header
            const top = heading.getBoundingClientRect().top + window.pageYOffset - offset;
            
            window.scrollTo({
                top: top,
                behavior: 'smooth'
            });
        }, 200);
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize modal controls
    Modal.initModalEventListeners();
    
    // Initialize floating header
    initFloatingHeader();
    
    // Add popstate listener for browser history
    window.addEventListener('popstate', (event) => {
        const urlParams = new URLSearchParams(window.location.search);
        const newPageId = urlParams.get('id');
        
        if (newPageId) {
            // Start transition first
            NotionRenderer.PageTransition.start(async () => {
                await NotionRenderer.loadPage(newPageId);
                NotionRenderer.PageTransition.complete();
                
                // Re-initialize floating header and TOC after page load
                setTimeout(() => {
                    initFloatingHeader();
                    initFloatingToc();
                }, 300);
            });
        }
    });
    
    // Load the initial page
    const urlParams = new URLSearchParams(window.location.search);
    const pageId = urlParams.get('id');
    if (pageId) {
        NotionRenderer.loadPage(pageId).then(() => {
            // Re-initialize floating header and TOC after initial page load
            setTimeout(() => {
                initFloatingHeader();
                initFloatingToc();
            }, 300);
        });
    }
    
    // Expose necessary functions to global scope for HTML onclick handlers
    window.loadChildPage = NotionRenderer.loadChildPage;
    window.toggleBlock = NotionRenderer.toggleBlock;
    window.copyCode = NotionRenderer.copyCode;
    window.copyPageLink = NotionRenderer.copyPageLink;
    window.openImageModal = Modal.openImageModal;
    window.closeImageModal = Modal.closeImageModal;
    window.toggleFloatingToc = toggleFloatingToc;
    window.hideFloatingToc = hideFloatingToc;
    window.scrollToHeading = scrollToHeading;
});

// Handle errors globally
window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    
    // Show error in UI if critical
    if (event.error && event.error.message && event.error.message.includes('critical')) {
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-banner';
        errorContainer.innerHTML = `
            <div class="error-content">
                <p>An error occurred: ${event.error.message}</p>
                <button onclick="window.location.reload()">Reload Page</button>
            </div>
        `;
        document.body.appendChild(errorContainer);
    }
}); 