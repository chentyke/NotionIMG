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
    progressBar.style.width = `${progress}%`;
    
    if (progress >= 100) {
        setTimeout(() => {
            document.getElementById('loadingProgress')?.classList.add('complete');
        }, 300);
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
        // 添加占位符
        const placeholder = document.createElement('div');
        placeholder.className = 'image-placeholder animate-pulse bg-gray-200 dark:bg-gray-700';
        placeholder.style.paddingBottom = '56.25%'; // 16:9 aspect ratio
        img.parentNode.insertBefore(placeholder, img);

        // 先加载缩略图
        const thumbnailUrl = await compressImage(img.dataset.src, 20);
            img.src = thumbnailUrl;
        img.style.filter = 'blur(10px)';
            img.style.transform = 'scale(1.1)';
                
        // 加载高清图
        const fullQualityUrl = await compressImage(img.dataset.src, 80);
                const fullImg = new Image();
        fullImg.src = fullQualityUrl;
                
                fullImg.onload = () => {
            img.src = fullQualityUrl;
                    img.style.filter = '';
                    img.style.transform = '';
                    img.classList.add('loaded');
                    if (placeholder) {
                        placeholder.remove();
                    }
                };
    } catch (error) {
        console.error('Error loading image:', error);
        img.src = img.dataset.src;
        img.onerror = () => {
            img.onerror = null;
            img.src = '';
            img.alt = 'Image failed to load';
            img.classList.add('border', 'border-red-300', 'bg-red-50', 'p-4', 'text-red-500');
        };
    }
    img.classList.remove('opacity-0');
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
    modal.style.display = "block";
    modalImg.src = originalUrl;
    // Force reflow
    modal.offsetHeight;
    modal.classList.add('visible');
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('visible');
    setTimeout(() => {
        modal.style.display = "none";
        // Reset modal image src
        document.getElementById('modalImage').src = '';
    }, 300);
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

// Load child page
async function loadChildPage(pageId, title) {
    // Update browser history
    window.history.pushState({}, "", `/static/page.html?id=${pageId}`);
    
    // Show loading state
    document.getElementById('pageContent').innerHTML = `
        <div class="flex justify-center py-8">
            <div class="loading-spinner"></div>
        </div>`;
    
    // Update page title immediately
    document.title = title;
    document.getElementById('pageTitle').textContent = title;
    
    // Load the new page content
    await loadPage(pageId);
}

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
            return `<h1 class="${blockColor}">${h1Text}</h1>`;
        case 'heading_2':
            const h2Text = block.heading_2?.rich_text 
                ? processRichText(block.heading_2.rich_text)
                : '';
            return `<h2 class="${blockColor}">${h2Text}</h2>`;
        case 'heading_3':
            const h3Text = block.heading_3?.rich_text 
                ? processRichText(block.heading_3.rich_text)
                : '';
            return `<h3 class="${blockColor}">${h3Text}</h3>`;
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

// Optimize page loading
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
        backButton.style.display = 'none';
        backButton.classList.remove('visible');
        
        // Reset cover
        pageCover.style.display = 'none';
        pageCover.classList.remove('loaded');
        pageCover.querySelector('img').src = '';
        
        // Start loading data
        updateLoadingProgress(10);
        loadingText.textContent = '正在获取页面数据...';
        const response = await fetch(`/page/${targetPageId}`);
        const data = await response.json();
        
        updateLoadingProgress(30);
        loadingText.textContent = '正在处理页面内容...';
        
        // Update page title and date
        document.title = data.page.title;
        updatePageTitle(data.page.title);
        
        // Handle cover image
        if (data.page.cover) {
            loadingText.textContent = '正在加载封面图片...';
            const coverImg = pageCover.querySelector('img');
            let coverUrl = '';
            
            if (data.page.cover.type === 'external') {
                coverUrl = data.page.cover.external.url;
            } else if (data.page.cover.type === 'file') {
                coverUrl = data.page.cover.file.url;
            }
            
            if (coverUrl) {
                const coverPromise = new Promise((resolve, reject) => {
                    coverImg.onload = resolve;
                    coverImg.onerror = reject;
                    coverImg.src = coverUrl;
                });
                
                try {
                    await coverPromise;
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
        
        // Show container with animation when everything is loaded
        updateLoadingProgress(90);
        loadingText.textContent = '即将完成...';
        
        setTimeout(() => {
            container.classList.add('loaded');
            updateLoadingProgress(100);
            
            // Hide loading overlay
            const loadingOverlay = document.getElementById('loadingOverlay');
            loadingOverlay.classList.add('fade-out');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                loadingOverlay.classList.remove('fade-out');
            }, 300);
        }, 300);
        
    } catch (error) {
        console.error('Error loading page content:', error);
        document.getElementById('pageContent').innerHTML = `
            <div class="text-center text-red-500">
                <p>Error loading page content.</p>
                <p class="text-sm mt-2">${error.message}</p>
            </div>`;
        // Update loading state
        const loadingText = document.querySelector('.loading-text');
        loadingText.textContent = '加载失败，请重试...';
        updateLoadingProgress(100);
        
        // Hide loading overlay
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            loadingOverlay.classList.add('fade-out');
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
                loadingOverlay.classList.remove('fade-out');
            }, 300);
        }, 1000);
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
        // Start closing animation
        requestAnimationFrame(() => {
            content.style.height = '0';
            content.style.opacity = '0';
            block.classList.remove('open');
        });
    } else {
        // Start opening animation
        block.classList.add('open');
        const targetHeight = contentInner.offsetHeight;
        content.style.height = '0';
        // Force reflow
        content.offsetHeight;
        // Trigger animation
        requestAnimationFrame(() => {
            content.style.height = targetHeight + 'px';
            content.style.opacity = '1';
        });
        
        // Reset height after animation
        content.addEventListener('transitionend', function handler(e) {
            if (e.propertyName === 'height' && block.classList.contains('open')) {
                content.style.height = 'auto';
                content.removeEventListener('transitionend', handler);
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