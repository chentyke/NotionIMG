// Switch tabs
function switchTab(tab) {
    const imagesSection = document.getElementById('imagesSection');
    const filesSection = document.getElementById('filesSection');
    const imagesTab = document.getElementById('imagesTab');
    const filesTab = document.getElementById('filesTab');
    
    if (tab === 'images') {
        imagesSection.classList.remove('hidden');
        filesSection.classList.add('hidden');
        imagesTab.classList.add('tab-active');
        filesTab.classList.remove('tab-active');
    } else {
        filesSection.classList.remove('hidden');
        imagesSection.classList.add('hidden');
        filesTab.classList.add('tab-active');
        imagesTab.classList.remove('tab-active');
    }
}

// Show loading state
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    element.innerHTML = `
        <div class="col-span-full flex justify-center py-12">
            <div class="loading-spinner"></div>
        </div>
    `;
}

// Compress image
async function compressImage(url, quality = 80) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) {
        console.error('Error compressing image:', error);
        return url;
    }
}

// Copy URL to clipboard
function copyUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        alert('URL copied to clipboard!');
    }).catch(err => {
        console.error('Error copying URL:', err);
        alert('Error copying URL');
    });
}

// Get file extension from content type
function getFileExtension(contentType) {
    const types = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf'
    };
    return types[contentType] || '';
}

// Load images
async function loadImages() {
    try {
        showLoading('imageGrid');
        const response = await fetch('/images');
        const data = await response.json();
        const imageGrid = document.getElementById('imageGrid');
        
        if (!data.images || data.images.length === 0) {
            imageGrid.innerHTML = `
                <div class="col-span-full empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                    </svg>
                    <p class="text-lg mb-2">暂无图片</p>
                    <p class="text-sm text-gray-500">请上传图片后刷新页面</p>
                </div>
            `;
            return;
        }
        
        imageGrid.innerHTML = '';
        
        // 先创建所有卡片并显示标题
        for (const image of data.images) {
            const card = document.createElement('div');
            card.className = 'image-card';
            const fullUrl = `${window.location.origin}/image/${image.id}`;
            
            card.innerHTML = `
                <div class="image-preview" onclick="window.open('${fullUrl}', '_blank')">
                    <div class="w-full h-full flex items-center justify-center bg-gray-100">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                <div class="content">
                    <h3 class="font-medium text-gray-800 truncate" title="${image.title}">${image.title}</h3>
                    <div class="button-group">
                        <button onclick="copyUrl('${fullUrl}')" class="action-button secondary flex-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                            </svg>
                            复制链接
                        </button>
                        <button onclick="downloadImage('${fullUrl}', '${image.title}')" class="action-button primary flex-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                            下载
                        </button>
                    </div>
                </div>
            `;
            imageGrid.appendChild(card);
        }
        
        // 异步加载每个图片的预览图
        data.images.forEach(async (image, index) => {
            try {
                const previewUrl = String(await compressImage(`/image/${image.id}`) || '');
                const imagePreview = imageGrid.children[index].querySelector('.image-preview');
                imagePreview.innerHTML = `<img src="${previewUrl}" alt="${image.title}" loading="lazy">`;
            } catch (err) {
                console.error('Error loading preview for image:', err);
                const imagePreview = imageGrid.children[index].querySelector('.image-preview');
                imagePreview.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center bg-gray-50">
                        <svg class="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </div>
                `;
            }
        });
        
    } catch (error) {
        console.error('Error loading images:', error);
        document.getElementById('imageGrid').innerHTML = `
            <div class="col-span-full empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-lg mb-2">加载图片失败</p>
                <p class="text-sm text-gray-500">请检查配置或稍后再试</p>
            </div>
        `;
    }
}

// Load files
async function loadFiles() {
    try {
        showLoading('fileGrid');
        const response = await fetch('/files');
        const data = await response.json();
        const fileGrid = document.getElementById('fileGrid');
        
        if (!data.files || data.files.length === 0) {
            fileGrid.innerHTML = `
                <div class="col-span-full empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-lg mb-2">暂无文件</p>
                    <p class="text-sm text-gray-500">请上传文件后刷新页面</p>
                </div>
            `;
            return;
        }
        
        fileGrid.innerHTML = '';
        
        // 先创建所有卡片并显示标题
        for (const file of data.files) {
            const card = document.createElement('div');
            card.className = 'image-card';
            const fullUrl = `${window.location.origin}/file/${file.id}`;
            
            card.innerHTML = `
                <div class="image-preview" onclick="window.open('${fullUrl}', '_blank')">
                    <div class="w-full h-full flex items-center justify-center bg-gray-100">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                <div class="content">
                    <h3 class="font-medium text-gray-800 truncate" title="${file.title}">${file.title}</h3>
                    <div class="button-group">
                        <button onclick="copyUrl('${fullUrl}')" class="action-button secondary flex-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                            </svg>
                            复制链接
                        </button>
                        <button onclick="downloadFile('${fullUrl}', '${file.title}')" class="action-button primary flex-1">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                            </svg>
                            下载
                        </button>
                    </div>
                </div>
            `;
            fileGrid.appendChild(card);
        }
        
        // 异步加载每个文件的预览图
        data.files.forEach(async (file, index) => {
            try {
                const previewUrl = await compressImage(`/file/${file.id}`);
                const filePreview = fileGrid.children[index].querySelector('.image-preview');
                filePreview.innerHTML = `<img src="${previewUrl}" alt="${file.title}" loading="lazy">`;
            } catch (err) {
                console.error('Error loading preview for file:', err);
                const filePreview = fileGrid.children[index].querySelector('.image-preview');
                filePreview.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center bg-gray-50">
                        <svg class="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                `;
            }
        });
    } catch (error) {
        console.error('Error loading files:', error);
        document.getElementById('fileGrid').innerHTML = `
            <div class="col-span-full empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p class="text-lg mb-2">加载文件失败</p>
                <p class="text-sm text-gray-500">请检查配置或稍后再试</p>
            </div>
        `;
    }
}

// Download image
async function downloadImage(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename + getFileExtension(response.headers.get('content-type'));
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error('Error downloading image:', err);
        alert('下载图片失败');
    }
}

// Download file
async function downloadFile(url, filename) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
        console.error('Error downloading file:', err);
        alert('下载文件失败');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('refreshImages').addEventListener('click', loadImages);
    document.getElementById('refreshFiles').addEventListener('click', loadFiles);

    // Initial load
    loadImages();
    loadFiles();
}); 