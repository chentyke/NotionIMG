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

/**
 * Initialize floating header scroll behavior
 */
function initFloatingHeader() {
    const floatingHeader = document.getElementById('floatingHeader');
    const floatingTitle = document.getElementById('floatingTitle');
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
            } else if (!shouldShow && floatingHeaderVisible) {
                floatingHeader.classList.remove('visible');
                floatingHeaderVisible = false;
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
                
                // Re-initialize floating header after page load
                setTimeout(initFloatingHeader, 300);
            });
        }
    });
    
    // Load the initial page
    const urlParams = new URLSearchParams(window.location.search);
    const pageId = urlParams.get('id');
    if (pageId) {
        NotionRenderer.loadPage(pageId).then(() => {
            // Re-initialize floating header after initial page load
            setTimeout(initFloatingHeader, 300);
        });
    }
    
    // Expose necessary functions to global scope for HTML onclick handlers
    window.loadChildPage = NotionRenderer.loadChildPage;
    window.toggleBlock = NotionRenderer.toggleBlock;
    window.copyCode = NotionRenderer.copyCode;
    window.copyPageLink = NotionRenderer.copyPageLink;
    window.openImageModal = Modal.openImageModal;
    window.closeImageModal = Modal.closeImageModal;
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