// Notion page rendering functionality
import { updateLoadingProgress } from './loader.js';
import { imageObserver } from './imageHandler.js';
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

// Table of Contents module - Disabled for right sidebar
const TableOfContents = {
    headings: [],
    container: null,
    
    init: function() {
        // Disabled - no longer showing right sidebar TOC
        this.container = null;
        this.headings = [];
    },
    
    addHeading: function(level, text, id) {
        // Still collect headings for potential future use, but don't display
        this.headings.push({ level, text, id });
    },
    
    build: function() {
        // Disabled - right sidebar TOC removed
        // The floating TOC will handle navigation instead
        return;
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
            // Use the processed text from our API response
            const paragraphText = block.text || '';
            return `<p ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${paragraphText}</p>`;
        
        case 'heading_1':
            // Use the processed text from our API response
            const h1Text = block.text || '';
            // Use actual block ID if available, otherwise fall back to generated ID
            const h1Id = block.id ? block.id.replace(/-/g, '') : generateHeadingId(h1Text);
            // Add to table of contents
            TableOfContents.addHeading(1, h1Text.replace(/<[^>]*>/g, ''), h1Id);
            return `<h1 id="${h1Id}" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${h1Text}</h1>`;
        
        case 'heading_2':
            // Use the processed text from our API response
            const h2Text = block.text || '';
            // Use actual block ID if available, otherwise fall back to generated ID
            const h2Id = block.id ? block.id.replace(/-/g, '') : generateHeadingId(h2Text);
            // Add to table of contents
            TableOfContents.addHeading(2, h2Text.replace(/<[^>]*>/g, ''), h2Id);
            return `<h2 id="${h2Id}" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${h2Text}</h2>`;
        
        case 'heading_3':
            // Use the processed text from our API response
            const h3Text = block.text || '';
            // Use actual block ID if available, otherwise fall back to generated ID
            const h3Id = block.id ? block.id.replace(/-/g, '') : generateHeadingId(h3Text);
            // Add to table of contents
            TableOfContents.addHeading(3, h3Text.replace(/<[^>]*>/g, ''), h3Id);
            return `<h3 id="${h3Id}" ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${h3Text}</h3>`;
        
        case 'bulleted_list_item':
            // Use the processed text from our API response
            const bulletText = block.text || '';
            return `<li ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${bulletText}</li>`;
        
        case 'numbered_list_item':
            // Use the processed text from our API response
            const numberedText = block.text || '';
            return `<li ${blockColorStyle ? `style="${blockColorStyle}"` : ''}>${numberedText}</li>`;
        
        case 'to_do':
            try {
                // Use the processed text from our API response
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
                        <div class="image-wrapper loading">
                            <img src="" data-src="${imgSrc}" alt="${caption}" 
                                class="rounded-lg shadow-md opacity-0 transition-all duration-300 ease-out"
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
            // Handle quote blocks - use processed text from API response
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
        
        case 'code':
            try {
                // Use the rich_text from our API response
                const codeText = block.rich_text 
                    ? block.rich_text.map(text => text.plain_text).join('')
                    : block.text || '';
                const language = block.language || 'plain text';
                const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;
                
                // Use the CodeHighlighter's language mapping
                const hljsLanguage = CodeHighlighter.getLanguageClass(language);
                
                // Apply color to the code block container if specified
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
                const columnsHtml = await Promise.all(block.columns.map(async (column, index) => {
                    if (column.children && column.children.length > 0) {
                        const columnContent = await Promise.all(column.children.map(async child => {
                            return await renderBlock(child);
                        }));
                        // Remove px-2 padding to ensure proper alignment - first column should align with other elements
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
            // Handle callout blocks - use processed text from API response
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
        
        // Apply syntax highlighting to code blocks using the new highlighter
        codeHighlighter.highlightAllCodeBlocks();
        
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
    TableOfContents,
    PageTransition
}; 