// HEIC图片转换模块
// 支持将HEIC格式图片转换为JPEG格式，提升兼容性

// HEIC 转换缓存
const heicCache = new Map();
let heic2anyLibrary = null;

/**
 * 检查浏览器是否原生支持HEIC格式
 * @returns {Promise<boolean>} 是否支持HEIC
 */
export async function checkHEICSupport() {
    return new Promise((resolve) => {
        try {
            // 使用Canvas检测方法，更可靠
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            
            canvas.toBlob((blob) => {
                // 如果能创建blob，说明浏览器支持基本功能
                // HEIC支持需要额外检测，保守返回false以确保转换
                resolve(false);
            }, 'image/jpeg', 0.1);
        } catch {
            resolve(false);
        }
    });
}

/**
 * 检查URL是否为HEIC图片
 * @param {string} url - 图片URL
 * @returns {boolean} 是否是HEIC图片
 */
export function isHEICImage(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('.heic') || 
           lowerUrl.includes('.heif') || 
           lowerUrl.includes('heic=') ||
           lowerUrl.includes('heif=');
}

/**
 * 动态加载heic2any库
 * @returns {Promise<object>} heic2any库对象
 */
export async function loadHeic2AnyLibrary() {
    if (heic2anyLibrary) {
        return heic2anyLibrary;
    }
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
        script.onload = () => {
            if (window.heic2any) {
                heic2anyLibrary = window.heic2any;
                console.log('✅ HEIC转换库加载成功');
                resolve(heic2anyLibrary);
            } else {
                reject(new Error('转换库加载失败'));
            }
        };
        script.onerror = () => reject(new Error('无法加载转换库'));
        document.head.appendChild(script);
    });
}

/**
 * 从URL获取图片数据，支持多种策略
 * @param {string} url - 图片URL
 * @returns {Promise<ArrayBuffer>} 图片数据
 */
async function fetchImageData(url) {
    // 获取策略（按优先级排序）
    const strategies = [
        // 策略1: 直接获取
        async () => {
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'image/*,*/*',
                    'User-Agent': 'Mozilla/5.0 (compatible; HEIC-Converter/1.0)'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            console.log(`✅ 直接获取成功: ${(arrayBuffer.byteLength / 1024).toFixed(1)}KB`);
            return arrayBuffer;
        },

        // 策略2: 服务器代理（核心策略）
        async () => {
            const proxyUrl = `/api/proxy/heic?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl, {
                mode: 'cors',
                credentials: 'omit'
            });
            
            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`服务器代理失败 (${response.status}): ${errorData}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            console.log(`✅ 服务器代理成功: ${(arrayBuffer.byteLength / 1024).toFixed(1)}KB`);
            return arrayBuffer;
        }
    ];
    
    // 按策略顺序尝试
    for (let i = 0; i < strategies.length; i++) {
        try {
            return await strategies[i]();
        } catch (error) {
            if (i === strategies.length - 1) {
                throw new Error(`无法获取HEIC图片数据: ${error.message}`);
            }
            // 继续尝试下一个策略
        }
    }
}

/**
 * 验证数据是否为有效的HEIC文件
 * @param {Uint8Array} uint8Array - 文件数据
 * @returns {boolean} 是否为有效HEIC
 */
function isValidHEICData(uint8Array) {
    try {
        if (uint8Array.length < 12) return false;
        
        // 检查HEIC文件签名
        const ftyp = String.fromCharCode(...uint8Array.slice(4, 8));
        const brand = String.fromCharCode(...uint8Array.slice(8, 12));
        
        return ftyp === 'ftyp' && (
            brand === 'heic' || 
            brand === 'heix' || 
            brand === 'hevc' || 
            brand === 'hevx' ||
            brand === 'mif1' // 也支持一些兼容格式
        );
    } catch {
        return false;
    }
}

/**
 * 将HEIC数据转换为JPEG
 * @param {ArrayBuffer} heicData - HEIC图片数据
 * @param {object} options - 转换选项
 * @returns {Promise<Blob>} 转换后的JPEG数据
 */
async function convertHEICToJPEG(heicData, options = {}) {
    const {
        quality = 0.8,
        format = 'image/jpeg',
        maxWidth = 1920,
        maxHeight = 1080
    } = options;
    
    try {
        console.log('🔄 Starting HEIC to JPEG conversion...');
        
        // 加载heic2any库
        const heic2any = await loadHeic2AnyLibrary();
        
        // 执行转换
        const convertedBlob = await heic2any({
            blob: new Blob([heicData]),
            toType: format,
            quality: quality
        });
        
        console.log(`✅ HEIC conversion successful: ${(convertedBlob.size / 1024).toFixed(1)}KB`);
        
        // 如果图片过大，进行额外压缩
        if (convertedBlob.size > 500000) { // 500KB以上进行压缩
            return await compressJPEGBlob(convertedBlob, maxWidth, maxHeight, quality);
        }
        
        return convertedBlob;
    } catch (error) {
        console.error('HEIC conversion failed:', error);
        throw error;
    }
}

/**
 * 压缩JPEG Blob
 * @param {Blob} jpegBlob - JPEG数据
 * @param {number} maxWidth - 最大宽度
 * @param {number} maxHeight - 最大高度
 * @param {number} quality - 质量
 * @returns {Promise<Blob>} 压缩后的JPEG数据
 */
async function compressJPEGBlob(jpegBlob, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        try {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 计算新尺寸
                let { width, height } = img;
                const aspectRatio = width / height;
                
                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / aspectRatio;
                }
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * aspectRatio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制并压缩
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((compressedBlob) => {
                    if (compressedBlob) {
                        console.log(`📦 Image compressed: ${(jpegBlob.size / 1024).toFixed(1)}KB → ${(compressedBlob.size / 1024).toFixed(1)}KB`);
                        resolve(compressedBlob);
                    } else {
                        reject(new Error('Failed to compress JPEG'));
                    }
                }, 'image/jpeg', quality);
            };
            
            img.onerror = () => reject(new Error('Failed to load JPEG for compression'));
            img.src = URL.createObjectURL(jpegBlob);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * 显示HEIC转换进度
 * @param {HTMLElement} wrapper - 图片容器
 * @param {string} status - 状态文本
 * @param {string} step - 步骤信息 (可选)
 */
function showHEICConversionProgress(wrapper, status, step = '') {
    if (!wrapper) return;
    
    let progressIndicator = wrapper.querySelector('.heic-conversion-progress');
    
    if (!progressIndicator) {
        progressIndicator = document.createElement('div');
        progressIndicator.className = 'heic-conversion-progress';
        progressIndicator.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 1.25rem 1.75rem;
            border-radius: 12px;
            font-size: 0.9rem;
            text-align: center;
            z-index: 10;
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 250px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        wrapper.appendChild(progressIndicator);
    }
    
    progressIndicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="
                width: 24px;
                height: 24px;
                border: 2px solid rgba(255, 255, 255, 0.3);
                border-top: 2px solid #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <div style="flex: 1; text-align: left;">
                <div style="font-weight: 500; margin-bottom: 0.25rem;">
                    HEIC转换中 ${step ? `(${step})` : ''}
                </div>
                <div style="font-size: 0.8rem; opacity: 0.8;">
                    ${status}
                </div>
            </div>
        </div>
    `;
}

/**
 * 隐藏HEIC转换进度
 * @param {HTMLElement} wrapper - 图片容器
 */
function hideHEICConversionProgress(wrapper) {
    if (!wrapper) return;
    
    const progressIndicator = wrapper.querySelector('.heic-conversion-progress');
    if (progressIndicator) {
        progressIndicator.style.opacity = '0';
        setTimeout(() => {
            if (progressIndicator.parentNode) {
                progressIndicator.remove();
            }
        }, 300);
    }
}

/**
 * 主要的HEIC转换函数
 * @param {string} heicUrl - HEIC图片URL
 * @param {HTMLElement} wrapper - 图片容器
 * @param {object} options - 转换选项
 * @returns {Promise<string>} 转换后的图片URL
 */
async function convertHEICImage(heicUrl, wrapper, options = {}) {
    let currentStep = 'init';
    
    try {
        console.log('🔍 Detected HEIC image, starting conversion:', heicUrl);
        
        // 步骤1: 获取HEIC数据
        currentStep = 'fetch';
        showHEICConversionProgress(wrapper, '正在下载HEIC图片...', '1/3');
        
        const heicData = await fetchImageData(heicUrl);
        console.log(`✅ HEIC数据获取成功: ${(heicData.byteLength / 1024).toFixed(1)}KB`);
        
        // 步骤2: 加载转换库
        currentStep = 'library';
        showHEICConversionProgress(wrapper, '正在加载转换库...', '2/3');
        
        const heic2any = await loadHeic2AnyLibrary();
        console.log('✅ 转换库加载成功');
        
        // 步骤3: 执行转换
        currentStep = 'convert';
        showHEICConversionProgress(wrapper, '正在转换为JPEG格式...', '3/3');
        
        const jpegBlob = await convertHEICToJPEG(heicData, {
            quality: options.quality || 0.85,
            maxWidth: options.maxWidth || 1920,
            maxHeight: options.maxHeight || 1080
        });
        
        // 创建对象URL
        const jpegUrl = URL.createObjectURL(jpegBlob);
        
        // 隐藏进度指示器
        hideHEICConversionProgress(wrapper);
        
        console.log('✅ HEIC conversion completed successfully');
        return jpegUrl;
        
    } catch (error) {
        console.error(`❌ HEIC conversion failed at step '${currentStep}':`, error);
        hideHEICConversionProgress(wrapper);
        
        // 根据失败的步骤显示不同的错误信息
        const errorInfo = getErrorInfo(currentStep, error);
        showHEICConversionError(wrapper, errorInfo, heicUrl);
        
        throw error;
    }
}

/**
 * 根据错误步骤获取详细错误信息
 * @param {string} step - 失败的步骤
 * @param {Error} error - 错误对象
 * @returns {object} 错误信息
 */
function getErrorInfo(step, error) {
    const errorTypes = {
        fetch: {
            title: 'HEIC图片获取失败',
            message: '无法下载HEIC图片文件',
            details: error.message.includes('cors') ? 
                'CORS跨域限制：Notion文件可能不允许外部访问' :
                error.message.includes('404') ?
                '文件不存在或已过期' :
                '网络连接问题或服务器错误',
            suggestions: [
                '检查网络连接',
                '确认文件链接未过期',
                '尝试在新标签页中打开原图片链接'
            ]
        },
        library: {
            title: 'HEIC转换库加载失败',
            message: '无法加载heic2any转换库',
            details: '可能是网络问题或CDN服务不可用',
            suggestions: [
                '检查网络连接',
                '稍后重试',
                '使用其他网络环境'
            ]
        },
        convert: {
            title: 'HEIC格式转换失败',
            message: '文件转换过程中出现错误',
            details: error.message.includes('invalid') ?
                '文件可能不是有效的HEIC格式或已损坏' :
                '转换过程中发生未知错误',
            suggestions: [
                '确认文件是有效的HEIC格式',
                '尝试用其他工具打开文件',
                '重新获取原始文件'
            ]
        },
        init: {
            title: 'HEIC转换初始化失败',
            message: '转换过程无法启动',
            details: '系统错误或参数不正确',
            suggestions: [
                '刷新页面重试',
                '检查浏览器兼容性'
            ]
        }
    };
    
    return errorTypes[step] || errorTypes.init;
}

/**
 * 显示HEIC转换错误信息
 * @param {HTMLElement} wrapper - 图片容器
 * @param {object} errorInfo - 错误信息
 * @param {string} originalUrl - 原始URL
 */
function showHEICConversionError(wrapper, errorInfo, originalUrl) {
    if (!wrapper) return;
    
    wrapper.classList.add('heic-conversion-failed');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'heic-conversion-error';
    errorDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #fee2e2;
        border: 1px solid #fecaca;
        color: #dc2626;
        padding: 1.5rem;
        border-radius: 12px;
        text-align: left;
        font-size: 0.9rem;
        max-width: 350px;
        z-index: 10;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    errorDiv.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 1rem;">
            <div style="
                background: #dc2626;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                margin-right: 0.75rem;
            ">⚠️</div>
            <div style="font-weight: 600; color: #7f1d1d;">${errorInfo.title}</div>
        </div>
        
        <div style="margin-bottom: 1rem;">
            <div style="font-weight: 500; margin-bottom: 0.5rem;">${errorInfo.message}</div>
            <div style="font-size: 0.8rem; color: #991b1b; line-height: 1.4;">
                ${errorInfo.details}
            </div>
        </div>
        
        <div style="margin-bottom: 1rem;">
            <div style="font-weight: 500; margin-bottom: 0.5rem; font-size: 0.8rem;">建议解决方案:</div>
            <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.8rem; color: #991b1b;">
                ${errorInfo.suggestions.map(suggestion => `<li style="margin-bottom: 0.25rem;">${suggestion}</li>`).join('')}
            </ul>
        </div>
        
        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button onclick="this.closest('.heic-conversion-error').remove()" style="
                flex: 1;
                background: #dc2626;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.8rem;
                cursor: pointer;
                transition: background-color 0.2s;
            " onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
                关闭
            </button>
            <button onclick="window.open('${originalUrl}', '_blank')" style="
                flex: 1;
                background: #6b7280;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.8rem;
                cursor: pointer;
                transition: background-color 0.2s;
            " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
                查看原图
            </button>
        </div>
    `;
    
    wrapper.appendChild(errorDiv);
}

/**
 * 智能图片加载器 - 自动处理HEIC转换
 * @param {string} imageUrl - 图片URL
 * @param {HTMLElement} wrapper - 图片容器
 * @param {object} options - 选项
 * @returns {Promise<string>} 最终的图片URL
 */
async function smartImageLoader(imageUrl, wrapper, options = {}) {
    console.log('🚀 smartImageLoader called with URL:', imageUrl);
    
    // 检查是否是HEIC图片
    const isHeic = isHEICImage(imageUrl);
    console.log('🔍 HEIC detection result:', isHeic);
    
    if (!isHeic) {
        console.log('⏭️ Not a HEIC image, returning original URL');
        return imageUrl; // 不是HEIC，直接返回原URL
    }
    
    try {
        // 检查浏览器是否原生支持HEIC
        console.log('🧪 Checking browser HEIC support...');
        const heicSupported = await checkHEICSupport();
        console.log('📊 Browser HEIC support result:', heicSupported);
        
        if (heicSupported) {
            console.log('✅ Browser supports HEIC natively, using original URL');
            return imageUrl; // 浏览器支持，直接返回原URL
        }
        
        // 需要转换HEIC
        console.log('🔄 Browser does not support HEIC, starting conversion...');
        console.log('📋 Conversion options:', options);
        
        try {
            const convertedUrl = await convertHEICImage(imageUrl, wrapper, options);
            console.log('🎉 HEIC conversion completed successfully!');
            console.log('🔗 Converted URL:', convertedUrl);
            return convertedUrl;
        } catch (conversionError) {
            console.error('💥 HEIC conversion process failed:', conversionError);
            console.error('📋 Conversion error details:', {
                message: conversionError.message,
                stack: conversionError.stack,
                name: conversionError.name
            });
            throw conversionError;
        }
        
    } catch (error) {
        console.error('💥 Error in smartImageLoader:', error);
        console.error('📋 Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        throw new Error(`HEIC conversion failed: ${error.message}`);
    }
}

// 添加CSS动画
if (typeof document !== 'undefined' && !document.querySelector('#heic-converter-styles')) {
    const style = document.createElement('style');
    style.id = 'heic-converter-styles';
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        .heic-conversion-progress {
            transition: opacity 0.3s ease;
        }
        
        .heic-conversion-failed {
            position: relative;
        }
        
        .heic-conversion-error {
            animation: slideIn 0.3s ease-out;
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translate(-50%, -60%);
            }
            to {
                opacity: 1;
                transform: translate(-50%, -50%);
            }
        }
    `;
    document.head.appendChild(style);
}

// 页面离开时清理blob URLs
window.addEventListener('beforeunload', () => {
    for (const url of heicCache.values()) {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    }
    heicCache.clear();
});

// 导出函数
export {
    checkHEICSupport,
    isHEICImage,
    convertHEICImage,
    smartImageLoader,
    loadHeic2AnyLibrary
}; 