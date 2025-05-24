// Notion page rendering functionality
import { updateLoadingProgress } from './loader.js';
import { imageObserver, initImageObserver } from './imageHandler.js';
import { processRichText, generateHeadingId, updatePageTitle } from './utils.js';
import { codeHighlighter, CodeHighlighter } from './codeHighlight.js';
import { 
    getTotalBlocks, 
    getLoadedBlocks, 
    getParentPageId,
    setTotalBlocks,
    setLoadedBlocks,
    incrementLoadedBlocks,
    setParentPageId
} from './core.js';

// TableOfContents module removed - using floating TOC instead

// Debounced TOC refresh function to avoid too frequent updates
let tocRefreshTimeout = null;
function debouncedTocRefresh() {
    if (tocRefreshTimeout) {
        clearTimeout(tocRefreshTimeout);
    }
    
    tocRefreshTimeout = setTimeout(() => {
        try {
            if (window.initFloatingToc && typeof window.initFloatingToc === 'function') {
                window.initFloatingToc();
            }
        } catch (error) {
            console.error('Error in debounced TOC refresh:', error);
        }
    }, 300); // 300ms delay to debounce rapid updates
}

// Page Transition module
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

// Color mapping for Notion colors to CSS classes and styles
function getNotionColorStyle(color) {
    if (!color || color === 'default') return '';
    
    const colorMap = {
        // Text colors
        'gray': 'color: #6B7280;',
        'brown': 'color: #92400E;',
        'orange': 'color: #EA580C;',
        'yellow': 'color: #D97706;',
        'green': 'color: #059669;',
        'blue': 'color: #2563EB;',
        'purple': 'color: #7C3AED;',
        'pink': 'color: #DB2777;',
        'red': 'color: #DC2626;',
        
        // Background colors
        'gray_background': 'background-color: #F3F4F6; padding: 0.25rem 0.5rem; border-radius: 0.25rem;',
        'brown_background': 'background-color: #FEF3C7; color: #92400E; padding: 0.25rem 0.5rem; border-radius: 0.25rem;',
        'orange_background': 'background-color: #FED7AA; color: #EA580C; padding: 0.25rem 0.5rem; border-radius: 0.25rem;',
        'yellow_background': 'background-color: #FEF3C7; color: #D97706; padding: 0.25rem 0.5rem; border-radius: 0.25rem;',
        'green_background': 'background-color: #D1FAE5; color: #059669; padding: 0.25rem 0.5rem; border-radius: 0.25rem;',
        'blue_background': 'background-color: #DBEAFE; color: #2563EB; padding: 0.25rem 0.5rem; border-radius: 0.25rem;',
        'purple_background': 'background-color: #E9D5FF; color: #7C3AED; padding: 0.25rem 0.5rem; border-radius: 0.25rem;',
        'pink_background': 'background-color: #FCE7F3; color: #DB2777; padding: 0.25rem 0.5rem; border-radius: 0.25rem;',
        'red_background': 'background-color: #FEE2E2; color: #DC2626; padding: 0.25rem 0.5rem; border-radius: 0.25rem;'
    };
    
    return colorMap[color] || '';
}

// Block Renderer Functions - Separated by functionality

// Text and heading renderers
async function renderParagraph(block, blockColorStyle) {
            const paragraphText = block.text || '';
            return `<p ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${paragraphText}</p>`;
}

async function renderHeading(block, level, blockColorStyle) {
    const text = block.text || '';
    const id = block.id ? block.id.replace(/-/g, '') : generateHeadingId(text);
    return `<h${level} id="${id}" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${text}</h${level}>`;
}

// List item renderer (shared by bulleted and numbered lists)
async function renderListItem(block, blockColorStyle) {
    const text = block.text || '';
    let listItemContent = `<li ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${text}`;
            
            // Handle nested children if present
            if (block.children && block.children.length > 0) {
                try {
                    // Group nested list items by type
                    let nestedLists = '';
                    let currentNestedList = null;
                    
                    for (const child of block.children) {
                        if (child.type === 'bulleted_list_item' || child.type === 'numbered_list_item') {
                            const nestedListTag = child.type === 'bulleted_list_item' ? 'ul' : 'ol';
                            
                            // Start a new nested list if needed
                            if (!currentNestedList || currentNestedList.tag !== nestedListTag) {
                                // Close previous nested list if exists
                                if (currentNestedList) {
                                    nestedLists += `</${currentNestedList.tag}>`;
                                }
                                
                                // Start new nested list
                                nestedLists += `<${nestedListTag} class="my-2 ${nestedListTag === 'ul' ? 'list-disc' : 'list-decimal'} ml-6">`;
                                currentNestedList = { tag: nestedListTag };
                            }
                            
                            // Render the nested list item
                            nestedLists += await renderBlock(child);
                        } else {
                            // For non-list items, close any open nested list and render the item
                            if (currentNestedList) {
                                nestedLists += `</${currentNestedList.tag}>`;
                                currentNestedList = null;
                            }
                            nestedLists += await renderBlock(child);
                        }
                    }
                    
                    // Close any remaining open nested list
                    if (currentNestedList) {
                        nestedLists += `</${currentNestedList.tag}>`;
                    }
                    
                    listItemContent += nestedLists;
                } catch (error) {
                    console.error('Error rendering nested list items:', error);
                }
            }
            
            listItemContent += '</li>';
            return listItemContent;
}

// Todo item renderer
async function renderTodoItem(block, blockColorStyle) {
    try {
                const todoText = block.text || 'Untitled todo item';
                const isChecked = block.checked || false;
                const color = block.color || 'default';
                
                return `
                    <div class="todo-item">
                        <input type="checkbox" ${isChecked ? 'checked' : ''} disabled 
                            class="todo-checkbox">
                        <span class="todo-text ${isChecked ? 'completed' : ''}" 
                            ${color !== 'default' ? 
                                `style="${getNotionColorStyle(color)}"` : ''}>
                            ${todoText}
                        </span>
                    </div>`;
            } catch (error) {
                console.error('Error rendering todo item:', error);
                return '<div class="text-red-500">Error rendering todo item</div>';
    }
            }
        
// Image renderer
async function renderImage(block) {
            try {
                let imgSrc = '';
                
                // Handle different image data structures
                if (block.image_url) {
                    imgSrc = block.image_url;
                } else if (block.image?.type === 'external') {
                    imgSrc = block.image.external.url;
                } else if (block.image?.type === 'file') {
                    imgSrc = block.image.file.url;
                }
                
                if (!imgSrc) return '';
                
        // Get caption if available
                let caption = '';
                if (block.caption) {
                    caption = block.caption;
                } else if (block.image?.caption) {
                    caption = processRichText(block.image.caption);
                }
                
                return `
                    <figure class="image-container my-4">
                        <div class="image-wrapper loading">
                            <img src="" data-src="${imgSrc}" alt="${caption}" 
                                class="rounded-lg shadow-md opacity-0 transition-all duration-300 ease-out"
                                onclick="openImageModalWithPreview(this, '${imgSrc}')" loading="lazy">
                        </div>
                        ${caption ? `<figcaption class="text-center text-sm text-gray-500 mt-2">${caption}</figcaption>` : ''}
                    </figure>`;
            } catch (error) {
                console.error('Error rendering image:', error);
                return '<div class="text-red-500">Error rendering image</div>';
            }
}

// Quote renderer
async function renderQuote(block, blockColorStyle) {
            const quoteText = block.text || '';
            let quoteChildren = '';
            
            // Process children if present
            if (block.children && block.children.length > 0) {
                try {
                    const childBlocks = await Promise.all(block.children.map(async child => {
                        return await renderBlock(child);
                    }));
                    quoteChildren = childBlocks.join('');
                } catch (error) {
                    console.error(`Error processing quote children: ${error}`);
                }
            }
            
            return `
                <blockquote class="border-l-4 pl-4 italic my-4" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>
                    ${quoteText}
                    ${quoteChildren}
                </blockquote>`;
}
        
// Code block renderer
async function renderCodeBlock(block, blockColorStyle) {
            try {
                const codeText = block.rich_text 
                    ? block.rich_text.map(text => text.plain_text).join('')
                    : block.text || '';
                const language = block.language || 'plain text';
                const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
                
                const hljsLanguage = CodeHighlighter.getLanguageClass(language);
                const codeContainerStyle = blockColorStyle ? ` style="${blockColorStyle}"` : '';
                
                return `
                    <div class="code-block"${codeContainerStyle}>
                        <div class="code-header">
                            <span class="code-language">${language}</span>
                            <button onclick="copyCode(this)" data-code-id="${codeId}" class="copy-code-btn">
                                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                        <pre><code id="${codeId}" class="language-${hljsLanguage}">${codeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                    </div>`;
            } catch (error) {
                console.error('Error rendering code block:', error);
                return '<div class="text-red-500">Error rendering code block</div>';
    }
            }
        
// Bookmark renderer
async function renderBookmark(block) {
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
}
                
// Child page renderer
async function renderChildPage(block) {
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
}
        
// Toggle block renderer
async function renderToggle(block, blockColorStyle) {
            const toggleId = `toggle-${Math.random().toString(36).substr(2, 9)}`;
            let toggleContent = '';
            
            // Recursively render nested blocks
            if (block.children && block.children.length > 0) {
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
                    <div class="toggle-header" onclick="toggleBlock('${toggleId}')" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>
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
}
        
// Column list and layout renderers
async function renderColumnList(block) {
            if (block.columns && block.columns.length > 0) {
                const columnsHtml = await Promise.all(block.columns.map(async (column, index) => {
                    if (column.children && column.children.length > 0) {
                        const columnContent = await Promise.all(column.children.map(async child => {
                            return await renderBlock(child);
                        }));
                        return `<div class="column flex-1">${columnContent.join('')}</div>`;
                    }
                    return '<div class="column flex-1"></div>';
                }));
                
                return `
                    <div class="column-list flex gap-4 my-4">
                        ${columnsHtml.join('')}
                    </div>`;
            }
            return '';
}
            
async function renderColumn(block) {
            if (block.children && block.children.length > 0) {
                const content = await Promise.all(block.children.map(async child => {
                    return await renderBlock(child);
                }));
                return content.join('');
            }
            return '';
}
            
// Table renderer
async function renderTable(block) {
            if (block.rows && block.rows.length > 0) {
                const hasColumnHeader = block.has_column_header || false;
                const hasRowHeader = block.has_row_header || false;
                
                let tableHtml = '<table class="table-auto w-full border-collapse border border-gray-300 my-4">';
                
                block.rows.forEach((row, rowIndex) => {
                    const isHeaderRow = hasColumnHeader && rowIndex === 0;
                    const tag = isHeaderRow ? 'th' : 'td';
                    const rowClass = isHeaderRow ? 'bg-gray-100 font-semibold' : '';
                    
                    tableHtml += `<tr class="${rowClass}">`;
                    
                    if (row.cells && row.cells.length > 0) {
                        row.cells.forEach((cell, cellIndex) => {
                            const isHeaderCell = hasRowHeader && cellIndex === 0 && !isHeaderRow;
                            const cellTag = isHeaderCell ? 'th' : tag;
                            const cellClass = isHeaderCell ? 'bg-gray-50 font-semibold' : '';
                            
                            // Process rich text in cell
                            let cellContent = '';
                            if (Array.isArray(cell)) {
                                cellContent = processRichText(cell);
                            } else if (typeof cell === 'string') {
                                cellContent = cell;
                            }
                            
                            tableHtml += `<${cellTag} class="border border-gray-300 px-3 py-2 ${cellClass}">${cellContent}</${cellTag}>`;
                        });
                    }
                    
                    tableHtml += '</tr>';
                });
                
                tableHtml += '</table>';
                return tableHtml;
            }
            return '';
}
            
// Callout renderer
async function renderCallout(block) {
            const calloutContent = block.text || '';
            
            let icon = '💡';
            if (block.callout?.icon) {
                if (block.callout.icon.type === 'emoji') {
                    icon = block.callout.icon.emoji;
                } else if (block.callout.icon.type === 'external') {
                    icon = `<img src="${block.callout.icon.external.url}" alt="icon">`;
                } else if (block.callout.icon.type === 'file') {
                    icon = `<img src="${block.callout.icon.file.url}" alt="icon">`;
                }
            }
            
            // Determine callout color class
            let colorClass = '';
            if (block.color && block.color !== 'default') {
                colorClass = ` callout-${block.color}`;
            }
            
            return `
                <div class="callout${colorClass}">
                    <div class="callout-icon">${icon}</div>
                    <div class="callout-content">${calloutContent}</div>
                </div>`;
}
                
// Media renderers
async function renderEmbed(block) {
            if (block.embed?.url) {
                return `
                    <div class="embed-block my-4">
                        <iframe src="${block.embed.url}" 
                                class="w-full h-96 border rounded-lg"
                                frameborder="0" 
                                allowfullscreen>
                        </iframe>
                        ${block.embed.caption ? 
                            `<div class="text-center text-sm text-gray-500 mt-2">${block.embed.caption}</div>` 
                            : ''}
                    </div>`;
            }
            return '';
}
            
async function renderVideo(block) {
            if (block.video?.url) {
                const videoUrl = block.video.url;
                
                // Check if it's a YouTube video
                if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
                    let embedUrl = videoUrl;
                    if (videoUrl.includes('watch?v=')) {
                        const videoId = videoUrl.split('watch?v=')[1]?.split('&')[0];
                        embedUrl = `https://www.youtube.com/embed/${videoId}`;
                    } else if (videoUrl.includes('youtu.be/')) {
                        const videoId = videoUrl.split('youtu.be/')[1]?.split('?')[0];
                        embedUrl = `https://www.youtube.com/embed/${videoId}`;
                    }
                    
                    return `
                        <div class="video-block my-4">
                            <iframe src="${embedUrl}" 
                                    class="w-full h-96 rounded-lg"
                                    frameborder="0" 
                                    allowfullscreen>
                            </iframe>
                            ${block.video.caption ? 
                                `<div class="text-center text-sm text-gray-500 mt-2">${block.video.caption}</div>` 
                                : ''}
                        </div>`;
                } else {
                    // Regular video file
                    return `
                        <div class="video-block my-4">
                            <video controls class="w-full rounded-lg">
                                <source src="${videoUrl}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                            ${block.video.caption ? 
                                `<div class="text-center text-sm text-gray-500 mt-2">${block.video.caption}</div>` 
                                : ''}
                        </div>`;
                }
            }
            return '';
}
            
async function renderEquation(block) {
            if (block.equation?.expression) {
                return `
                    <div class="equation-block my-4 text-center">
                        <div class="bg-gray-50 p-4 rounded-lg inline-block">
                            <code class="text-lg">${block.equation.expression}</code>
                        </div>
                    </div>`;
            }
            return '';
}
            
async function renderFile(block) {
            if (block.file?.url) {
                const fileName = block.file.name || 'Download File';
                return `
                    <div class="file-block border rounded-lg p-4 my-4 hover:bg-gray-50 transition-colors">
                        <a href="${block.file.url}" target="_blank" rel="noopener noreferrer" 
                           class="flex items-center gap-3 text-blue-600 hover:text-blue-700">
                            <i class="fas fa-file text-2xl"></i>
                            <div class="flex-1">
                                <div class="font-medium">${fileName}</div>
                                ${block.file.caption ? 
                                    `<div class="text-sm text-gray-500">${block.file.caption}</div>` 
                                    : ''}
                            </div>
                            <i class="fas fa-download"></i>
                        </a>
                    </div>`;
            }
            return '';
}

/**
 * Load a child page
 * @param {string} pageId - The ID of the page to load
 * @param {string} title - The title of the page
 */
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
        
        // Update page title immediately using the utility function
        updatePageTitle(title);
        
        // Load the new page content
        await loadPage(pageId);
        
        // Complete transition after page is loaded
        PageTransition.complete();
    });
}

/**
 * Render a Notion block - Refactored with delegated renderers
 * @param {Object} block - The block to render
 * @returns {string} - HTML representation of the block
 */
async function renderBlock(block) {
    incrementLoadedBlocks();
    updateLoadingProgress((getLoadedBlocks() / getTotalBlocks()) * 100);
    
    const blockColorStyle = getNotionColorStyle(block.color);

    switch (block.type) {
        case 'paragraph':
            return await renderParagraph(block, blockColorStyle);
        
        case 'heading_1':
            return await renderHeading(block, 1, blockColorStyle);
        
        case 'heading_2':
            return await renderHeading(block, 2, blockColorStyle);
        
        case 'heading_3':
            return await renderHeading(block, 3, blockColorStyle);
        
        case 'bulleted_list_item':
        case 'numbered_list_item':
            return await renderListItem(block, blockColorStyle);
        
        case 'to_do':
            return await renderTodoItem(block, blockColorStyle);
        
        case 'image':
            return await renderImage(block);
        
        case 'divider':
            return '<hr class="my-6 border-gray-200">';
        
        case 'quote':
            return await renderQuote(block, blockColorStyle);
        
        case 'code':
            return await renderCodeBlock(block, blockColorStyle);
        
        case 'bookmark':
            return await renderBookmark(block);
                
        case 'child_page':
            return await renderChildPage(block);
        
        case 'toggle':
            return await renderToggle(block, blockColorStyle);
        
        case 'column_list':
            return await renderColumnList(block);
            
        case 'column':
            return await renderColumn(block);
            
        case 'table':
            return await renderTable(block);
            
        case 'callout':
            return await renderCallout(block);
                
        case 'embed':
            return await renderEmbed(block);
            
        case 'video':
            return await renderVideo(block);
            
        case 'equation':
            return await renderEquation(block);
            
        case 'file':
            return await renderFile(block);
        
        default:
            // Log unhandled block types for debugging
            console.warn(`Unhandled block type: ${block.type}`, block);
            return '';
    }
}

// validateBlockOrder function removed - debug functionality no longer needed

/**
 * Load and render a Notion page
 * @param {string} pageId - The ID of the page to load
 */
async function loadPage(pageId = null) {
    // Get page ID from URL if not provided
    const targetPageId = pageId || new URLSearchParams(window.location.search).get('id');
    
    if (!targetPageId) {
        document.getElementById('pageContent').innerHTML = `
            <div class="text-center text-red-500">
                <p>No page ID specified.</p>
                <p class="text-sm mt-2">Please provide a valid Notion page ID.</p>
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
        
        // Start loading data - Initial load with limit=15
        updateLoadingProgress(10);
        loadingText.textContent = '正在获取页面数据...';
        
        // Initial load with only 15 blocks to avoid rate limiting
        const response = await fetch(`/api/page/${targetPageId}?limit=15`);
        
        // Check for errors
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        updateLoadingProgress(30);
        loadingText.textContent = '正在处理页面内容...';
        
        // Log debug information if available
        if (data.debug_info) {
            console.log('API Debug Info:', data.debug_info);
        }
        
        // Render page cover and basic info
        if (data.page) {
            // Update document title
            updatePageTitle(data.page.title);
            
            // Store parent page ID
            if (data.page.parent_id) {
                setParentPageId(data.page.parent_id);
            }
            
            // Set total blocks count for progress tracking (estimate based on initial load)
            const estimatedTotal = data.has_more ? data.blocks.length * 3 : data.blocks.length;
            setTotalBlocks(estimatedTotal);
            setLoadedBlocks(0);
            
            // Show page cover if available
            if (data.page.cover && pageCover) {
                const img = pageCover.querySelector('img');
                if (img) {
                    img.onload = () => {
                        updateLoadingProgress(40);
                        pageCover.style.display = 'block';
                        setTimeout(() => {
                            pageCover.classList.add('loaded');
                        }, 100);
                    };
                    img.src = data.page.cover;
                }
            } else {
                updateLoadingProgress(40);
            }
            
            // Update page header using the utility function
            updatePageTitle(data.page.title);
            const editDate = document.getElementById('editDate');
            
            if (editDate && data.page.edit_date) {
                const date = new Date(data.page.edit_date);
                editDate.innerHTML = `<i class="fa fa-edit"></i> 最后编辑：${date.toLocaleDateString('zh-CN')}`;
            }
            
            // Handle back button visibility
            if (backButton && data.page.show_back !== false) {
                backButton.style.display = 'flex';
                setTimeout(() => {
                    backButton.classList.add('visible');
                }, 300);
            }
        }
        
        // Initial render of the first 15 blocks
        updateLoadingProgress(50);
        loadingText.textContent = '正在渲染内容...';
        
        const content = await renderBlocks(data.blocks);
        
        updateLoadingProgress(80);
        loadingText.textContent = '正在完成加载...';
        
        // Display initial content
        const pageContent = document.getElementById('pageContent');
        pageContent.innerHTML = content;
        
        // Initialize image lazy loading for the initial content
        try {
            initImageObserver();
        } catch (error) {
            console.error('Error initializing image observer:', error);
        }
        
        // Post-process the initial content
        try {
            postProcessContent(pageContent);
        } catch (error) {
            console.error('Error post-processing content:', error);
        }
        updateLoadingProgress(90);
        
        // Set up a fallback timer to ensure page shows even if something goes wrong
        const fallbackTimer = setTimeout(() => {
            const container = document.querySelector('.container');
            if (!container.classList.contains('loaded')) {
                container.classList.add('loaded');
                updateLoadingProgress(100);
            }
        }, 5000); // 5 second fallback
        
        setTimeout(() => {
            container.classList.add('loaded');
            updateLoadingProgress(100);
            
            // Clear the fallback timer since we completed successfully
            clearTimeout(fallbackTimer);
            
            // Initialize floating TOC for the initial content
            try {
                if (window.initFloatingToc && typeof window.initFloatingToc === 'function') {
                    window.initFloatingToc();
                }
            } catch (error) {
                console.error('Error initializing floating TOC after page load:', error);
            }
            
            // Start loading remaining content in background if there's more
            if (data.has_more && data.next_cursor) {
                loadMoreContentInBackground(targetPageId, data.next_cursor, pageContent);
            }
        }, 200);
        
    } catch (error) {
        console.error('Error loading page:', error);
        
        // Clear any existing fallback timer
        if (typeof fallbackTimer !== 'undefined') {
            clearTimeout(fallbackTimer);
        }
        
        const pageContent = document.getElementById('pageContent');
        pageContent.innerHTML = `
            <div class="text-center text-red-500">
                <div class="text-6xl mb-4">⚠️</div>
                <h2 class="text-2xl font-bold mb-4">页面加载失败</h2>
                <p class="mb-4">无法加载页面内容。请检查页面ID是否正确，或稍后重试。</p>
                <p class="text-sm text-gray-600 mb-4">错误信息：${error.message}</p>
                <button onclick="window.location.reload()" 
                        class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                    重新加载
                </button>
            </div>`;
        
        // Show container even on error
        const container = document.querySelector('.container');
        setTimeout(() => {
            container.classList.add('loaded');
        }, 100);
    }
}

/**
 * Load remaining content in background to avoid blocking initial page load
 * @param {string} pageId - The page ID
 * @param {string} cursor - The cursor for next batch
 * @param {HTMLElement} pageContent - The content container
 */
async function loadMoreContentInBackground(pageId, cursor, pageContent) {
    try {
        
        // Add a minimal loading indicator at the bottom without extra spacing
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'background-loading';
        loadingIndicator.className = 'loading-indicator-minimal';
        loadingIndicator.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-dot"></div>
                <div class="spinner-dot"></div>
                <div class="spinner-dot"></div>
            </div>
        `;
        loadingIndicator.style.cssText = `
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            padding: 0.5rem 0 !important;
            margin: 0 !important;
            transition: opacity 0.3s ease !important;
            min-height: auto !important;
            max-height: none !important;
            border: none !important;
            background: none !important;
        `;
        pageContent.appendChild(loadingIndicator);
        
        let hasMore = true;
        let nextCursor = cursor;
        let batchCount = 0;
        let failedAttempts = 0;
        let totalBlocksCollected = 0;
        const allNewBlocks = []; // 收集所有新块以确保正确顺序
        const maxRetries = 3;
        const maxFailedAttempts = 5; // 允许5次失败
        const maxBatches = 100; // 大幅增加批次限制，支持超长文档
        let consecutiveTimeouts = 0; // 跟踪连续超时次数
        
        // 简化的进度更新（不显示UI，只记录关键日志）
        const updateProgress = (current, failed = 0) => {
            // 只在重要节点记录日志
            if (current % 20 === 0 || failed > 0) {
                // 减少日志输出
            }
        };
        
        // 第一步：收集所有剩余的块，使用改进的错误处理和重试机制
        // 同时实现每10个块的实时渲染，提升用户体验
        const blocksToRender = []; // 临时收集待渲染的块
        const renderThreshold = 10; // 每10个块渲染一次
        
        while (hasMore && batchCount < maxBatches && failedAttempts < maxFailedAttempts) {
            let retryCount = 0;
            let batchSuccess = false;
            
            updateProgress(batchCount + 1, failedAttempts);
            
            while (retryCount < maxRetries && !batchSuccess) {
                try {
                    // 动态调整延迟时间，随着批次增加而增加
                    // 考虑Vercel冷启动的影响，增加基础延迟
                    const baseDelay = 1200; // 增加基础延迟以适应Vercel
                    const dynamicDelay = baseDelay + (batchCount * 300) + (failedAttempts * 800);
                    
                    if (batchCount > 0 || retryCount > 0) {
                        await new Promise(resolve => setTimeout(resolve, dynamicDelay));
                    }
                    
                    // 动态调整每批次的块数量，考虑Vercel的10秒限制
                    // 较小的批次避免函数超时
                    let batchSize = Math.max(10, Math.min(20, 25 - Math.floor(batchCount / 5) * 2));
                    
                    // 如果有连续超时，进一步减少批次大小
                    if (consecutiveTimeouts > 0) {
                        batchSize = Math.max(5, Math.floor(batchSize / (consecutiveTimeouts + 1)));
                    }
                    
                    // 在重试时进一步减少批次大小
                    if (retryCount > 0) {
                        batchSize = Math.max(3, Math.floor(batchSize / (retryCount + 1)));
                    }
                    
                    const response = await fetch(`/api/page/${pageId}/more?cursor=${nextCursor}&limit=${batchSize}`);
                
                if (!response.ok) {
                        // 特殊处理不同的HTTP错误
                        if (response.status === 504 || response.status === 503) {
                            throw new Error(`Function timeout (${response.status}): Reducing batch size for next attempt`);
                        }
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                
                    const responseText = await response.text();
                    
                    // 检查是否是Vercel的错误页面
                    if (responseText.includes('FUNCTION_INVOCATION_TIMEOUT') || 
                        responseText.includes('An error occurred with your deployment')) {
                        throw new Error('Vercel function timeout - reducing batch size');
                    }
                    
                    let moreData;
                    try {
                        moreData = JSON.parse(responseText);
                    } catch (parseError) {
                        console.error('Failed to parse response:', responseText.substring(0, 200));
                        throw new Error(`Invalid JSON response: ${parseError.message}`);
                    }
                    
                    // 检查服务器是否返回了错误信息
                    if (moreData.error) {
                        console.warn(`Server returned error for batch ${batchCount + 1}:`, moreData.error);
                        // 即使服务器返回错误，如果有部分数据，也要处理
                        if (!moreData.blocks || moreData.blocks.length === 0) {
                            throw new Error(`Server error: ${moreData.error}`);
                        }
                    }
                
                if (moreData.blocks && moreData.blocks.length > 0) {
                        // 按顺序添加到临时数组中
                        for (const block of moreData.blocks) {
                            block._sequence = totalBlocksCollected;
                            block._batch = batchCount;
                            blocksToRender.push(block);
                            allNewBlocks.push(block);
                            totalBlocksCollected += 1;
                            
                            // 每收集到renderThreshold个块就渲染一次
                            if (blocksToRender.length >= renderThreshold) {
                                await renderIncrementalBlocks(blocksToRender, pageContent, loadingIndicator);
                                blocksToRender.length = 0; // 清空已渲染的块
                            }
                        }
                        
                        // 成功加载时只在控制台显示简要信息
                        if (batchCount % 5 === 0 || moreData.blocks.length < batchSize) {
                            // 减少日志输出
                        }
                    }
                    
                    hasMore = moreData.has_more;
                    nextCursor = moreData.next_cursor;
                    batchSuccess = true;
                    
                    // 重置连续超时计数器，因为这次成功了
                    consecutiveTimeouts = 0;
                    
                    // 重置失败计数器，因为这次成功了
                    if (retryCount > 0) {
                        // 减少日志输出
                    }
                    
                } catch (error) {
                    retryCount++;
                    const isTimeoutError = error.message.includes('timeout') || 
                                         error.message.includes('Timeout') || 
                                         error.message.includes('FUNCTION_INVOCATION_TIMEOUT');
                    
                    console.error(`Error loading batch ${batchCount + 1} (attempt ${retryCount}/${maxRetries}):`, error);
                    
                    // 如果是超时错误，尝试减少批次大小
                    if (isTimeoutError && retryCount < maxRetries) {
                        console.warn(`Timeout detected for batch ${batchCount + 1}, will use smaller batch size on retry`);
                        // 在重试时动态减少批次大小，但不修改当前批次的batchSize变量
                    }
                    
                    if (retryCount >= maxRetries) {
                        failedAttempts++;
                        
                        // 如果是超时错误，增加连续超时计数器
                        if (isTimeoutError) {
                            consecutiveTimeouts++;
                            console.warn(`Consecutive timeout #${consecutiveTimeouts} for batch ${batchCount + 1}`);
                        }
                        
                        console.warn(`Failed to load batch ${batchCount + 1} after ${maxRetries} attempts. Failed attempts: ${failedAttempts}/${maxFailedAttempts}`);
                        
                        // 即使这个批次失败，也继续尝试下一个批次（如果有的话）
                        if (failedAttempts < maxFailedAttempts && hasMore) {
                            batchSuccess = true; // 允许继续到下一个批次
                            
                            // 为失败的批次创建一个占位符块
                            const errorMessage = isTimeoutError ? 
                                `批次 ${batchCount + 1} 超时无法加载 (可能因为Vercel函数限制)` :
                                `批次 ${batchCount + 1} 无法加载 - ${error.message}`;
                            
                            const errorBlock = {
                                type: "paragraph",
                                text: `<span class="text-red-500">[加载错误: ${errorMessage}]</span>`,
                                color: "red",
                                id: `error-batch-${batchCount + 1}`,
                                _sequence: totalBlocksCollected,
                                _error: true
                            };
                            allNewBlocks.push(errorBlock);
                            totalBlocksCollected += 1;
                        }
                    } else {
                        // 等待更长时间再重试，超时错误等待更久
                        const retryDelay = isTimeoutError ? 
                            2000 * retryCount + Math.random() * 1000 : 
                            1000 * retryCount + Math.random() * 1000;
                        console.log(`Waiting ${retryDelay}ms before retry ${retryCount + 1}`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                    }
                }
            }
            
            batchCount++;
            
            // 检查是否应该停止
            if (!hasMore) {
                console.log('No more blocks available');
                break;
            }
            
            if (failedAttempts >= maxFailedAttempts) {
                console.warn(`Stopping background loading due to too many failed attempts (${failedAttempts})`);
                break;
            }
        }
        
        // 渲染剩余的块（如果有不足renderThreshold的块）
        if (blocksToRender.length > 0) {
            await renderIncrementalBlocks(blocksToRender, pageContent, loadingIndicator);
        }
        
        // 处理加载完成的情况
        if (batchCount >= maxBatches) {
            console.warn(`Reached maximum batch limit (${maxBatches}). Loaded ${totalBlocksCollected} blocks.`);
            const indicator = document.getElementById('background-loading');
            if (indicator) {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator && indicator.parentNode) {
                        indicator.remove();
                    }
                }, 300);
            }
        } else {
            // Remove loading indicator if all content loaded successfully
            const indicator = document.getElementById('background-loading');
            if (indicator) {
                indicator.style.opacity = '0';
                setTimeout(() => {
                    if (indicator && indicator.parentNode) {
                        indicator.remove();
                    }
                }, 300);
            }
        }
        
        console.log(`Background loading completed. Processed ${batchCount} batches, collected ${totalBlocksCollected} total blocks, failed attempts: ${failedAttempts}`);
        
    } catch (error) {
        console.error('Error in background loading:', error);
        const indicator = document.getElementById('background-loading');
        if (indicator) {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator && indicator.parentNode) {
                    indicator.remove();
                }
            }, 300);
        }
    }
}

/**
 * Calculate the starting number for an ordered list to continue numbering
 * Only counts if there's an immediately adjacent ordered list
 * @param {HTMLElement} pageContent - Page content container
 * @param {HTMLElement} loadingIndicator - Loading indicator element
 * @returns {number} - The next number to start from (1 if should restart)
 */
function calculateOrderedListStart(pageContent, loadingIndicator) {
    // 找到加载指示器之前的最后一个元素
    const lastElement = pageContent.children[pageContent.children.length - 2]; // -2 because last is loading indicator
    
    // 如果最后一个元素是有序列表，则继续编号
    if (lastElement && lastElement.tagName === 'OL') {
        const listItems = lastElement.querySelectorAll('li');
        const currentStart = parseInt(lastElement.getAttribute('start') || '1');
        return currentStart + listItems.length;
    }
    
    // 如果最后一个元素不是有序列表，则从1开始
    return 1;
}

/**
 * Get the last list context for proper continuation
 * @param {HTMLElement} pageContent - Page content container  
 * @param {HTMLElement} loadingIndicator - Loading indicator element
 * @returns {Object|null} - List context or null
 */
function getLastListContext(pageContent, loadingIndicator) {
    // 找到加载指示器之前的最后一个元素
    const lastElement = pageContent.children[pageContent.children.length - 2]; // -2 because last is loading indicator
    
    if (lastElement && (lastElement.tagName === 'UL' || lastElement.tagName === 'OL')) {
        const listItems = lastElement.querySelectorAll('li');
        const startValue = parseInt(lastElement.getAttribute('start') || '1');
        
        return {
            element: lastElement,
            tag: lastElement.tagName.toLowerCase(),
            type: lastElement.tagName === 'UL' ? 'bulleted_list_item' : 'numbered_list_item',
            itemCount: listItems.length,
            startValue: startValue,
            nextNumber: startValue + listItems.length
        };
    }
    
    return null;
}

/**
 * Render incremental blocks during background loading (every 10 blocks)
 * @param {Array} blocks - Blocks to render
 * @param {HTMLElement} pageContent - Page content container
 * @param {HTMLElement} loadingIndicator - Loading indicator element
 */
async function renderIncrementalBlocks(blocks, pageContent, loadingIndicator) {
    if (blocks.length === 0) return;
    
    try {
        // 验证和排序块
        // Sort blocks by sequence if available
        if (blocks[0]._sequence !== undefined) {
            blocks.sort((a, b) => (a._sequence || 0) - (b._sequence || 0));
        }
        
        // 使用统一的渲染逻辑，传入上下文信息
        const content = await renderBlocksWithContext(blocks, pageContent, loadingIndicator);
        
        // 只有在有处理过的内容时才添加到页面
        if (content.trim()) {
            // 创建临时容器
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            
            // 为新内容添加简单的渐入动画，避免影响布局间距
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                const element = tempDiv.firstChild;
                
                // 添加简单的透明度动画，不影响布局
                if (element.nodeType === Node.ELEMENT_NODE) {
                    element.style.cssText = `
                        opacity: 0;
                        transition: opacity 0.3s ease;
                    `;
                    
                    // 延迟添加显示动画
                    setTimeout(() => {
                        element.style.opacity = '1';
                    }, 50);
                }
                
                fragment.appendChild(element);
            }
            
            pageContent.insertBefore(fragment, loadingIndicator);
            
            // Post-process the new content
            postProcessContent(pageContent);
            
            console.log(`Successfully rendered ${blocks.length} incremental blocks`);
        }
    } catch (error) {
        console.error('Error rendering incremental blocks:', error);
    }
}

/**
 * Render intermediate batch of blocks during background loading
 */
async function renderIntermediateBatch(blocks, pageContent, loadingIndicator) {
    if (blocks.length === 0) return;
    
    try {
        console.log(`Rendering intermediate batch: ${blocks.length} blocks`);
        
        // Sort blocks by sequence if available
        if (blocks[0]._sequence !== undefined) {
            blocks.sort((a, b) => (a._sequence || 0) - (b._sequence || 0));
        }
        
        // 使用上下文感知的渲染函数
        const content = await renderBlocksWithContext(blocks, pageContent, loadingIndicator);
        
        if (content.trim()) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                const element = tempDiv.firstChild;
                
                // 添加简单的透明度动画，避免影响布局间距
                if (element.nodeType === Node.ELEMENT_NODE) {
                    element.style.cssText = `
                        opacity: 0;
                        transition: opacity 0.3s ease;
                    `;
                    
                    // 延迟添加显示动画
                    setTimeout(() => {
                        element.style.opacity = '1';
                    }, 50);
                }
                
                fragment.appendChild(element);
            }
            pageContent.insertBefore(fragment, loadingIndicator);
            
            // Post-process the new content
            postProcessContent(pageContent);
            
            console.log(`Successfully rendered intermediate batch: ${blocks.length} blocks`);
        }
    } catch (error) {
        console.error('Error rendering intermediate batch:', error);
    }
}

/**
 * Render final batch of blocks
 */
async function renderFinalBatch(allNewBlocks, pageContent, loadingIndicator) {
    try {
        console.log(`Rendering ${allNewBlocks.length} final additional blocks in correct order...`);
        
        // 确保块按序列顺序排列（如果有序列信息的话）
        if (allNewBlocks[0]._sequence !== undefined) {
            allNewBlocks.sort((a, b) => (a._sequence || 0) - (b._sequence || 0));
        }
        
        // 使用统一的上下文感知渲染函数
        const content = await renderBlocksWithContext(allNewBlocks, pageContent, loadingIndicator);
        
        // 只有在有处理过的内容时才添加到页面
        if (content.trim()) {
            // 创建临时容器
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = content;
            
            // 按顺序插入新内容到加载指示器之前，添加简单的渐入动画
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                const element = tempDiv.firstChild;
                
                // 添加简单的透明度动画，避免影响布局间距
                if (element.nodeType === Node.ELEMENT_NODE) {
                    element.style.cssText = `
                        opacity: 0;
                        transition: opacity 0.3s ease;
                    `;
                    
                    // 延迟添加显示动画
                    setTimeout(() => {
                        element.style.opacity = '1';
                    }, 50);
                }
                
                fragment.appendChild(element);
            }
            pageContent.insertBefore(fragment, loadingIndicator);
            
            console.log(`Successfully added ${allNewBlocks.length} blocks in correct order`);
        }
        
        // 后处理新内容（这也会刷新目录）
        postProcessContent(pageContent);
        
        // Remove loading indicator with smooth transition
        const indicator = document.getElementById('background-loading');
        if (indicator) {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator && indicator.parentNode) {
                    indicator.remove();
                }
            }, 300);
        }
        
    } catch (error) {
        console.error('Error rendering final batch:', error);
        const indicator = document.getElementById('background-loading');
        if (indicator) {
            indicator.innerHTML = `
                <div class="text-red-500">
                    <span>渲染内容时出错</span>
                </div>
            `;
            setTimeout(() => {
                if (indicator && indicator.parentNode) {
                    indicator.remove();
                }
            }, 3000);
        }
    }
}

/**
 * Render multiple blocks with context awareness for list continuation
 * @param {Array} blocks - Array of blocks to render
 * @param {HTMLElement} pageContent - Page content container (optional, for context)
 * @param {HTMLElement} loadingIndicator - Loading indicator element (optional, for context)
 * @returns {string} - HTML content
 */
async function renderBlocksWithContext(blocks, pageContent = null, loadingIndicator = null) {
    // 确保块按序列顺序排列（如果有序列信息的话）
    if (blocks && blocks.length > 0 && blocks[0]._sequence !== undefined) {
        blocks.sort((a, b) => (a._sequence || 0) - (b._sequence || 0));
        console.log(`Sorted ${blocks.length} blocks by sequence number`);
    }
    
    let content = '';
    let currentList = null;
    let orderedListStart = 1;
    let listContinuationHandled = false;
    
    // 如果有上下文信息，获取最后的列表状态
    if (pageContent && loadingIndicator) {
        const lastListContext = getLastListContext(pageContent, loadingIndicator);
        if (lastListContext && lastListContext.tag === 'ol') {
            orderedListStart = lastListContext.nextNumber;
            console.log(`Context-aware ordered list start: ${orderedListStart}`);
        }
    }
    
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        try {
            // Log block processing for debugging
            if (block._sequence !== undefined) {
                console.log(`Rendering block ${i+1}/${blocks.length}, sequence: ${block._sequence}, type: ${block.type}`);
            }
            
            // Special handling for list items to group them
            if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
                const listTag = block.type === 'bulleted_list_item' ? 'ul' : 'ol';
                
                // 检查是否可以续接现有列表（仅对第一个块检查）
                if (i === 0 && pageContent && loadingIndicator && !listContinuationHandled) {
                    const lastElement = pageContent.children[pageContent.children.length - 2];
                    if (lastElement && lastElement.tagName === listTag.toUpperCase()) {
                        // 直接添加到现有列表，不创建新列表
                        const listItem = await renderBlock(block);
                        lastElement.insertAdjacentHTML('beforeend', listItem);
                        listContinuationHandled = true;
                        
                        // 更新编号（如果是有序列表）
                        if (listTag === 'ol') {
                            orderedListStart++;
                        }
                        continue;
                    }
                }
                
                // Start a new list if needed
                if (!currentList || currentList.tag !== listTag) {
                    // Close previous list if exists
                    if (currentList) {
                        content += `</${currentList.tag}>`;
                    }
                    
                    // For ordered lists, use calculated start number
                    if (listTag === 'ol') {
                        content += `<${listTag} class="my-4 list-decimal ml-6" start="${orderedListStart}">`;
                        console.log(`Starting new ordered list from ${orderedListStart}`);
                    } else {
                        content += `<${listTag} class="my-4 list-disc ml-6">`;
                    }
                    
                    currentList = { tag: listTag, type: block.type, startNumber: orderedListStart };
                }
                
                // Add the list item
                content += await renderBlock(block);
                
                // Increment counter for ordered lists
                if (listTag === 'ol') {
                    orderedListStart++;
                }
            } else {
                // For non-list items, close any open list and reset numbering
                if (currentList) {
                    content += `</${currentList.tag}>`;
                    currentList = null;
                    orderedListStart = 1; // Reset numbering for next ordered list
                }
                
                // Add the block content
                content += await renderBlock(block);
            }
        } catch (error) {
            console.error(`Error rendering block ${block.id}:`, error);
            content += `<div class="text-red-500">Error rendering a block: ${error.message}</div>`;
        }
    }
    
    // Close any remaining open list
    if (currentList) {
        content += `</${currentList.tag}>`;
    }

    return content;
}

/**
 * Render multiple blocks (legacy function for initial page load)
 * @param {Array} blocks - Array of blocks to render
 * @returns {string} - HTML content
 */
async function renderBlocks(blocks) {
    return await renderBlocksWithContext(blocks, null, null);
}

/**
 * Post-process rendered content (apply syntax highlighting, etc.)
 * @param {HTMLElement} container - The container with rendered content
 */
function postProcessContent(container) {
    try {
        console.log('Starting post-processing...');
        
        // Apply syntax highlighting to code blocks
        console.log('Applying syntax highlighting...');
        try {
            codeHighlighter.highlightAllCodeBlocks();
            console.log('Syntax highlighting applied successfully');
        } catch (error) {
            console.error('Error applying syntax highlighting:', error);
        }
        
        // Initialize lazy loading for new images
        console.log('Setting up lazy loading for images...');
        try {
            const images = container.querySelectorAll('img[data-src]');
            console.log(`Found ${images.length} images to observe`);
            images.forEach(img => {
                imageObserver.observe(img);
            });
            console.log('Image lazy loading set up successfully');
        } catch (error) {
            console.error('Error setting up image lazy loading:', error);
        }
        
        // Refresh floating TOC to include new headings
        console.log('Refreshing floating TOC...');
        try {
            debouncedTocRefresh();
            console.log('Floating TOC refresh scheduled');
        } catch (error) {
            console.error('Error refreshing floating TOC:', error);
        }
        
        console.log('Post-processing completed');
    } catch (error) {
        console.error('Error in postProcessContent:', error);
    }
}

/**
 * Toggle show/hide of a collapsible block
 * @param {string} id - The ID of the toggle block
 */
function toggleBlock(id) {
    const block = document.getElementById(id);
    if (!block) return;
    
    const content = block.querySelector('.toggle-content');
    const icon = block.querySelector('.toggle-icon');
    
    if (block.classList.contains('open')) {
        // Collapse
        content.style.height = '0';
        content.style.opacity = '0';
        block.classList.remove('open');
        
        // Rotate icon back
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
    } else {
        // Expand
        block.classList.add('open');
        const contentHeight = content.scrollHeight;
        content.style.height = contentHeight + 'px';
        content.style.opacity = '1';
        
        // Rotate icon
        if (icon) {
            icon.style.transform = 'rotate(90deg)';
        }
        
        // Handle animation completion
        content.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'height') {
                // If still expanded after animation, set to "auto" to allow flexible height
                if (block.classList.contains('open')) {
                    content.style.height = 'auto';
                }
                content.removeEventListener('transitionend', handler);
            }
        });
    }
}

/**
 * Copy code from a code block - Enhanced version
 * @param {HTMLElement} button - The button that was clicked
 */
function copyCode(button) {
    const enhancedCopyCode = CodeHighlighter.enhanceCopyCode();
    enhancedCopyCode(button);
}

// Make copyCode globally accessible
window.copyCode = copyCode;

/**
 * Copy current page link to clipboard with enhanced user feedback
 */
function copyPageLink() {
    const currentUrl = window.location.href;
    
    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(currentUrl)
            .then(() => {
                showCopySuccess('页面链接已复制到剪贴板');
            })
            .catch(err => {
                console.error('Failed to copy with clipboard API:', err);
                fallbackCopyToClipboard(currentUrl);
            });
    } else {
        // Fallback for older browsers or non-secure contexts
        fallbackCopyToClipboard(currentUrl);
    }
}

/**
 * Fallback method to copy text to clipboard
 * @param {string} text - Text to copy
 */
function fallbackCopyToClipboard(text) {
    try {
        // Create a temporary textarea element
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
            showCopySuccess('页面链接已复制到剪贴板');
        } else {
            showCopyError('复制失败，请手动复制链接');
        }
    } catch (err) {
        console.error('Fallback copy failed:', err);
        showCopyError('复制失败，请手动复制链接');
    }
}

/**
 * Show success message for copy operation
 * @param {string} message - Success message to display
 */
function showCopySuccess(message) {
    // Update copy button temporarily
    const copyButtons = document.querySelectorAll('.copy-link-button');
    copyButtons.forEach(button => {
        const originalHTML = button.innerHTML;
        const icon = button.querySelector('i');
        const span = button.querySelector('span');
        
        // Change icon to checkmark
        if (icon) {
            icon.className = 'fas fa-check';
            icon.style.color = '#10b981'; // green color
        }
        
        // Change text if span exists
        if (span) {
            span.textContent = '已复制';
        }
        
        // Add success class
        button.classList.add('copy-success');
        
        // Restore original state after 2 seconds
        setTimeout(() => {
            if (icon) {
                icon.className = 'fas fa-link';
                icon.style.color = '';
            }
            if (span) {
                span.textContent = '复制链接';
            }
            button.classList.remove('copy-success');
        }, 2000);
    });
    
    // Show toast notification
    showToast(message, 'success');
}

/**
 * Show error message for copy operation
 * @param {string} message - Error message to display
 */
function showCopyError(message) {
    // Update copy button temporarily
    const copyButtons = document.querySelectorAll('.copy-link-button');
    copyButtons.forEach(button => {
        const icon = button.querySelector('i');
        const span = button.querySelector('span');
        
        // Change icon to error
        if (icon) {
            icon.className = 'fas fa-exclamation-triangle';
            icon.style.color = '#ef4444'; // red color
        }
        
        // Change text if span exists
        if (span) {
            span.textContent = '复制失败';
        }
        
        // Add error class
        button.classList.add('copy-error');
        
        // Restore original state after 2 seconds
        setTimeout(() => {
            if (icon) {
                icon.className = 'fas fa-link';
                icon.style.color = '';
            }
            if (span) {
                span.textContent = '复制链接';
            }
            button.classList.remove('copy-error');
        }, 2000);
    });
    
    // Show toast notification
    showToast(message, 'error');
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast ('success', 'error', 'info')
 */
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast-notification');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('toast-show');
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('toast-show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

/**
 * Transition to another page with animation
 * @param {string} pageId - The ID of the page to transition to
 * @param {string} title - The title of the page
 */
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

// Export all necessary functions and objects
export {
    loadPage,
    loadChildPage,
    renderBlock,
    toggleBlock,
    copyCode,
    copyPageLink,
    transitionToPage,
    PageTransition
}; 