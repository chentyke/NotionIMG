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
let fullscreenTocVisible = false;
let floatingTocHeadings = [];

/**
 * Initialize floating header scroll behavior
 */
function initFloatingHeader() {
    const floatingHeader = document.getElementById('floatingHeader');
    const floatingTitle = document.getElementById('floatingTitle');
    const floatingTocIsland = document.getElementById('floatingTocIsland');
    const pageTitle = document.getElementById('pageTitle');
    
    if (!floatingHeader || !floatingTitle) return;
    
    // Update floating title when page title changes
    const updateFloatingTitle = () => {
        if (pageTitle && pageTitle.textContent) {
            floatingTitle.textContent = pageTitle.textContent;
        }
    };
    
    // Initial update
    updateFloatingTitle();
    
    // Watch for page title changes
    const observer = new MutationObserver(updateFloatingTitle);
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
                
                // Show TOC island if headings exist
                if (floatingTocHeadings.length > 0 && floatingTocIsland) {
                    floatingTocIsland.classList.add('visible');
                }
            } else if (!shouldShow && floatingHeaderVisible) {
                floatingHeader.classList.remove('visible');
                floatingHeaderVisible = false;
                
                // Hide TOC island and close TOC modal
                if (floatingTocIsland) {
                    floatingTocIsland.classList.remove('visible');
                }
                hideFullscreenToc();
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
    setTimeout(handleScroll, 100);
}

/**
 * Initialize floating TOC functionality
 */
function initFloatingToc() {
    floatingTocHeadings = [];
    
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
    
    // Build fullscreen TOC HTML
    buildFullscreenToc();
    
    // Update scroll spy
    updateFullscreenTocScrollSpy();
}

/**
 * Build fullscreen TOC HTML structure
 */
function buildFullscreenToc() {
    const fullscreenTocList = document.getElementById('fullscreenTocList');
    if (!fullscreenTocList || floatingTocHeadings.length === 0) return;
    
    let html = '';
    floatingTocHeadings.forEach(heading => {
        html += `
            <li>
                <a class="level-${heading.level}" onclick="scrollToHeading('${heading.id}'); return false;">
                    ${heading.text}
                </a>
            </li>
        `;
    });
    
    fullscreenTocList.innerHTML = html;
}

/**
 * Update fullscreen TOC scroll spy to highlight current section
 */
function updateFullscreenTocScrollSpy() {
    if (floatingTocHeadings.length === 0) return;
    
    const handleScrollSpy = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let currentHeading = null;
        
        // Find the current heading based on scroll position
        for (let i = floatingTocHeadings.length - 1; i >= 0; i--) {
            const heading = document.getElementById(floatingTocHeadings[i].id);
            if (heading) {
                const headingTop = heading.getBoundingClientRect().top + scrollTop;
                if (scrollTop >= headingTop - 100) {
                    currentHeading = floatingTocHeadings[i].id;
                    break;
                }
            }
        }
        
        // Update active states
        const tocLinks = document.querySelectorAll('#fullscreenTocList a');
        tocLinks.forEach(link => {
            const linkText = link.textContent.trim();
            const matchingHeading = floatingTocHeadings.find(h => h.text === linkText);
            
            if (currentHeading && matchingHeading && matchingHeading.id === currentHeading) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
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
 * Toggle fullscreen TOC visibility
 */
function toggleFullscreenToc() {
    if (fullscreenTocVisible) {
        hideFullscreenToc();
    } else {
        showFullscreenToc();
    }
}

/**
 * Show fullscreen TOC
 */
function showFullscreenToc() {
    const fullscreenToc = document.getElementById('fullscreenToc');
    if (!fullscreenToc) return;
    
    fullscreenToc.classList.add('visible');
    fullscreenTocVisible = true;
    
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            hideFullscreenToc();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Hide fullscreen TOC
 */
function hideFullscreenToc() {
    const fullscreenToc = document.getElementById('fullscreenToc');
    if (!fullscreenToc) return;
    
    fullscreenToc.classList.remove('visible');
    fullscreenTocVisible = false;
    
    // Restore body scroll
    document.body.style.overflow = '';
}

/**
 * Scroll to specific heading
 */
function scrollToHeading(headingId) {
    const heading = document.getElementById(headingId);
    if (heading) {
        const offset = 100; // Account for floating header
        const top = heading.getBoundingClientRect().top + window.pageYOffset - offset;
        
        // Hide TOC first
        hideFullscreenToc();
        
        // Smooth scroll to heading
        window.scrollTo({
            top: top,
            behavior: 'smooth'
        });
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
    window.toggleFullscreenToc = toggleFullscreenToc;
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