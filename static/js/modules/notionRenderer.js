// Notion page rendering functionality
import { updateLoadingProgress } from './loader.js';
import { imageObserver } from './imageHandler.js';
import { processRichText, generateHeadingId, updatePageTitle } from './utils.js';
import { 
    getTotalBlocks, 
    getLoadedBlocks, 
    getParentPageId,
    setTotalBlocks,
    setLoadedBlocks,
    incrementLoadedBlocks,
    setParentPageId
} from './core.js';

// Table of Contents module
const TableOfContents = {
    headings: [],
    container: null,
    
    init: function() {
        this.container = document.getElementById('tableOfContents');
        this.headings = [];
    },
    
    addHeading: function(level, text, id) {
        this.headings.push({ level, text, id });
    },
    
    build: function() {
        if (!this.container || this.headings.length === 0) return;
        
        let html = '<ul class="toc-list">';
        let prevLevel = 0;
        
        this.headings.forEach((heading, index) => {
            if (heading.level > prevLevel) {
                // Start a new nested list
                html += '<ul class="nested-list">';
            } else if (heading.level < prevLevel) {
                // Close previous lists
                for (let i = 0; i < prevLevel - heading.level; i++) {
                    html += '</ul>';
                }
            }
            
            html += `<li class="toc-item level-${heading.level}">
                <a href="#${heading.id}" class="toc-link">${heading.text}</a>
            </li>`;
            
            prevLevel = heading.level;
            
            // Close any open lists at the end
            if (index === this.headings.length - 1) {
                for (let i = 0; i < prevLevel; i++) {
                    html += '</ul>';
                }
            }
        });
        
        html += '</ul>';
        
        this.container.innerHTML = html;
        
        // Show TOC if it has content
        if (this.headings.length > 0) {
            this.container.classList.add('visible');
        }
    }
};

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
        
        // Update page title immediately
        document.title = title;
        document.getElementById('pageTitle').textContent = title;
        
        // Load the new page content
        await loadPage(pageId);
        
        // Complete transition after page is loaded
        PageTransition.complete();
    });
}

/**
 * Render a Notion block
 * @param {Object} block - The block to render
 * @returns {string} - HTML representation of the block
 */
async function renderBlock(block) {
    incrementLoadedBlocks();
    updateLoadingProgress((getLoadedBlocks() / getTotalBlocks()) * 100);
    
    let content = '';
    // Fix color handling - use inline styles instead of classes
    const blockColorStyle = getNotionColorStyle(block.color);

    switch (block.type) {
        case 'paragraph':
            const paragraphText = block.paragraph?.rich_text 
                ? processRichText(block.paragraph.rich_text)
                : '';
            return `<p ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${paragraphText}</p>`;
        
        case 'heading_1':
            const h1Text = block.heading_1?.rich_text 
                ? processRichText(block.heading_1.rich_text)
                : '';
            const h1Id = `heading-${block.id || generateHeadingId(h1Text)}`;
            // Add to table of contents
            TableOfContents.addHeading(1, h1Text.replace(/<[^>]*>/g, ''), h1Id);
            return `<h1 id="${h1Id}" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${h1Text}</h1>`;
        
        case 'heading_2':
            const h2Text = block.heading_2?.rich_text 
                ? processRichText(block.heading_2.rich_text)
                : '';
            const h2Id = `heading-${block.id || generateHeadingId(h2Text)}`;
            // Add to table of contents
            TableOfContents.addHeading(2, h2Text.replace(/<[^>]*>/g, ''), h2Id);
            return `<h2 id="${h2Id}" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${h2Text}</h2>`;
        
        case 'heading_3':
            const h3Text = block.heading_3?.rich_text 
                ? processRichText(block.heading_3.rich_text)
                : '';
            const h3Id = `heading-${block.id || generateHeadingId(h3Text)}`;
            // Add to table of contents
            TableOfContents.addHeading(3, h3Text.replace(/<[^>]*>/g, ''), h3Id);
            return `<h3 id="${h3Id}" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${h3Text}</h3>`;
        
        case 'bulleted_list_item':
            const bulletText = block.bulleted_list_item?.rich_text 
                ? processRichText(block.bulleted_list_item.rich_text)
                : '';
            return `<li ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${bulletText}</li>`;
        
        case 'numbered_list_item':
            const numberedText = block.numbered_list_item?.rich_text 
                ? processRichText(block.numbered_list_item.rich_text)
                : '';
            return `<li ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${numberedText}</li>`;
        
        case 'to_do':
            try {
                // 处理两种可能的数据格式
                const todoText = block.to_do?.rich_text ? 
                    processRichText(block.to_do.rich_text) : 
                    block.text || 'Untitled todo item';
                    
                const isChecked = block.to_do?.checked || block.checked || false;
                const color = block.to_do?.color || block.color || 'default';
                
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
        
        case 'image':
            try {
                let imgSrc = '';
                
                // Handle different image data structures
                if (block.image_url) {
                    // Current API structure
                    imgSrc = block.image_url;
                } else if (block.image?.type === 'external') {
                    // Standard Notion API structure
                    imgSrc = block.image.external.url;
                } else if (block.image?.type === 'file') {
                    // Standard Notion API structure
                    imgSrc = block.image.file.url;
                }
                
                if (!imgSrc) return '';
                
                // Get caption if available - handle different structures
                let caption = '';
                if (block.caption) {
                    // Current API structure - caption is a string
                    caption = block.caption;
                } else if (block.image?.caption) {
                    // Standard Notion API structure - caption is rich text array
                    caption = processRichText(block.image.caption);
                }
                
                return `
                    <figure class="image-container my-4">
                        <div class="image-wrapper">
                            <img src="" data-src="${imgSrc}" alt="${caption}" 
                                class="rounded-lg shadow-md opacity-0 transition-all duration-700 ease-out"
                                onclick="openImageModal('${imgSrc}')" loading="lazy">
                        </div>
                        ${caption ? `<figcaption class="text-center text-sm text-gray-500 mt-2">${caption}</figcaption>` : ''}
                    </figure>`;
            } catch (error) {
                console.error('Error rendering image:', error);
                return '<div class="text-red-500">Error rendering image</div>';
            }
        
        case 'divider':
            return '<hr class="my-6 border-gray-200">';
        
        case 'quote':
            // Handle quote blocks
            const quoteText = block.quote?.rich_text 
                ? processRichText(block.quote.rich_text)
                : '';
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
        
        case 'code':
            try {
                const codeText = block.code?.rich_text 
                    ? block.code.rich_text.map(text => text.plain_text).join('')
                    : '';
                const language = block.code?.language || 'plain text';
                const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
                
                // Apply color to the code block container if specified
                const codeContainerStyle = blockColorStyle ? ` style="${blockColorStyle}"` : '';
                
                return `
                    <div class="code-block relative my-4"${codeContainerStyle}>
                        <div class="flex justify-between items-center bg-gray-800 text-white px-4 py-2 text-sm rounded-t-lg">
                            <span>${language}</span>
                            <button onclick="copyCode(this)" data-code-id="${codeId}" class="copy-code-btn">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                                </svg>
                            </button>
                        </div>
                        <pre class="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto text-sm leading-relaxed"><code id="${codeId}">${codeText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                    </div>`;
            } catch (error) {
                console.error('Error rendering code block:', error);
                return '<div class="text-red-500">Error rendering code block</div>';
            }
        
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
        
        case 'toggle':
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
        
        case 'column_list':
            // Handle column list blocks
            if (block.columns && block.columns.length > 0) {
                const columnsHtml = await Promise.all(block.columns.map(async column => {
                    if (column.children && column.children.length > 0) {
                        const columnContent = await Promise.all(column.children.map(async child => {
                            return await renderBlock(child);
                        }));
                        return `<div class="column flex-1 px-2">${columnContent.join('')}</div>`;
                    }
                    return '<div class="column flex-1 px-2"></div>';
                }));
                
                return `
                    <div class="column-list flex gap-4 my-4">
                        ${columnsHtml.join('')}
                    </div>`;
            }
            return '';
            
        case 'column':
            // Individual columns are handled by column_list
            if (block.children && block.children.length > 0) {
                const content = await Promise.all(block.children.map(async child => {
                    return await renderBlock(child);
                }));
                return content.join('');
            }
            return '';
            
        case 'table':
            // Handle table blocks
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
            
        case 'callout':
            // Handle callout blocks
            let calloutContent = '';
            if (block.callout?.rich_text) {
                calloutContent = processRichText(block.callout.rich_text);
            }
            
            let icon = '💡';
            if (block.callout?.icon) {
                if (block.callout.icon.type === 'emoji') {
                    icon = block.callout.icon.emoji;
                } else if (block.callout.icon.type === 'external') {
                    icon = `<img src="${block.callout.icon.external.url}" alt="icon" class="w-5 h-5">`;
                } else if (block.callout.icon.type === 'file') {
                    icon = `<img src="${block.callout.icon.file.url}" alt="icon" class="w-5 h-5">`;
                }
            }
            
            return `
                <div class="callout border-l-4 border-blue-400 bg-blue-50 p-4 my-4" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>
                    <div class="flex items-start gap-3">
                        <div class="callout-icon text-lg">${icon}</div>
                        <div class="callout-content flex-1">${calloutContent}</div>
                    </div>
                </div>`;
                
        case 'embed':
            // Handle embed blocks
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
            
        case 'video':
            // Handle video blocks
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
            
        case 'equation':
            // Handle equation blocks
            if (block.equation?.expression) {
                return `
                    <div class="equation-block my-4 text-center">
                        <div class="bg-gray-50 p-4 rounded-lg inline-block">
                            <code class="text-lg">${block.equation.expression}</code>
                        </div>
                    </div>`;
            }
            return '';
            
        case 'file':
            // Handle file blocks
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
        
        default:
            // Log unhandled block types for debugging
            console.warn(`Unhandled block type: ${block.type}`, block);
            return '';
    }
}

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
        
        // Start loading data
        updateLoadingProgress(10);
        loadingText.textContent = '正在获取页面数据...';
        const response = await fetch(`/api/page/${targetPageId}`);
        
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
        setParentPageId(data.page.parent_id);
        const backButtonContainer = document.querySelector('.mt-8');
        const pageTitle = document.getElementById('pageTitle');
        
        if (pageTitle && data.page.title) {
            pageTitle.textContent = data.page.title;
        }
        
        if (backButtonContainer) {
            // Show back button if parent page exists and show_back is true
            if (data.page.parent_id && data.page.show_back !== false) {
                backButtonContainer.style.display = 'flex';
                
                // Update the back button link
                const backLink = backButtonContainer.querySelector('a');
                if (backLink) {
                    backLink.href = `/static/page.html?id=${data.page.parent_id}`;
                    backLink.onclick = (e) => {
                        e.preventDefault();
                        loadChildPage(data.page.parent_id, 'Parent Page');
                        return false;
                    };
                }
                
                // Animate the back button appearance
                setTimeout(() => {
                    backButtonContainer.classList.add('visible');
                }, 300);
            } else {
                backButtonContainer.style.display = 'none';
            }
        }
        
        // Render the blocks
        loadingText.textContent = '正在渲染页面内容...';
        
        // Initialize table of contents
        TableOfContents.init();
        
        // Reset block counters
        setTotalBlocks(data.blocks.length);
        setLoadedBlocks(0);
        
        updateLoadingProgress(50);
        
        // Process blocks in batches and handle list types specially
        let content = '';
        let currentList = null;
        
        for (const block of data.blocks) {
            try {
                // Special handling for list items to group them
                if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item') {
                    const listTag = block.type === 'bulleted_list_item' ? 'ul' : 'ol';
                    
                    // Start a new list if needed
                    if (!currentList || currentList.tag !== listTag) {
                        // Close previous list if exists
                        if (currentList) {
                            content += `</${currentList.tag}>`;
                        }
                        
                        // Start new list
                        content += `<${listTag} class="my-4 ${listTag === 'ul' ? 'list-disc' : 'list-decimal'} ml-6">`;
                        currentList = { tag: listTag, type: block.type };
                    }
                    
                    // Add the list item
                    content += await renderBlock(block);
                } else {
                    // For non-list items, close any open list
                    if (currentList) {
                        content += `</${currentList.tag}>`;
                        currentList = null;
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
        
        document.getElementById('pageContent').innerHTML = content;
        
        // Initialize lazy loading for images
        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
        
        // Initialize TOC after content is rendered
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

/**
 * Toggle show/hide of a collapsible block
 * @param {string} id - The ID of the toggle block
 */
function toggleBlock(id) {
    const block = document.getElementById(id);
    if (!block) return;
    
    const content = block.querySelector('.toggle-content');
    const icon = block.querySelector('.toggle-icon');
    
    if (content.style.maxHeight) {
        // Collapse
        content.style.maxHeight = null;
        block.classList.remove('expanded');
        
        // Rotate icon back
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
    } else {
        // Expand
        block.classList.add('expanded');
        const contentHeight = content.scrollHeight;
        content.style.maxHeight = contentHeight + 'px';
        
        // Rotate icon
        if (icon) {
            icon.style.transform = 'rotate(90deg)';
        }
        
        // Handle animation completion
        content.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'max-height') {
                // If still expanded after animation, set to "none" to allow flexible height
                if (block.classList.contains('expanded')) {
                    content.style.maxHeight = 'none';
                }
                content.removeEventListener('transitionend', handler);
            }
        });
    }
}

/**
 * Copy code from a code block
 * @param {HTMLElement} button - The button that was clicked
 */
function copyCode(button) {
    const codeId = button.getAttribute('data-code-id');
    const codeElement = document.getElementById(codeId);
    if (!codeElement) return;
    
    const text = codeElement.innerText;
    
    // Use Clipboard API
    navigator.clipboard.writeText(text).then(() => {
        // Show success state on button
        const originalHTML = button.innerHTML;
        button.innerHTML = `
            <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `;
        button.classList.add('copied');
        
        // Reset after 2 seconds
        setTimeout(() => {
            button.innerHTML = originalHTML;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy code: ', err);
    });
}

/**
 * Copy current page link to clipboard
 */
function copyPageLink() {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
        // Show success message with toast
        // This would require implementing a toast notification system
        console.log('Page link copied to clipboard');
    }).catch(err => {
        console.error('Failed to copy page link: ', err);
    });
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
    TableOfContents,
    PageTransition
}; 