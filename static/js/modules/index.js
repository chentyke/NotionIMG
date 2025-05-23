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
let scrollPosition = 0; // 保存滚动位置
let scrollSpyPaused = false; // 标记是否暂停scroll spy

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
            floatingHeader.removeAttribute('onclick');
        } else {
            // 有标题时，显示面包屑和启用点击
            floatingBreadcrumb.style.display = 'block';
            floatingHeader.style.cursor = 'pointer';
            floatingHeader.setAttribute('title', '点击查看目录');
            floatingHeader.setAttribute('aria-label', '点击查看目录');
            floatingHeader.setAttribute('onclick', 'toggleFloatingToc()');
            
            if (currentActiveHeading) {
                const heading = floatingTocHeadings.find(h => h.id === currentActiveHeading);
                if (heading) {
                    // 构建面包屑路径
                    const breadcrumbPath = buildBreadcrumbPath(heading);
                    floatingBreadcrumb.innerHTML = breadcrumbPath;
                }
            } else {
                floatingBreadcrumb.innerHTML = '';
            }
        }
    };
    
    // Initial update
    updateFloatingTitle();
    
    // Watch for page title changes
    const observer = new MutationObserver(() => {
        updateFloatingTitle();
        // 延迟更新面包屑，确保TOC已初始化
        setTimeout(updateBreadcrumb, 200);
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
    
    // Store update function for later use
    floatingHeader._updateBreadcrumb = updateBreadcrumb;
    
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
    
    // 构建层级路径，不包含页面标题（避免重复）
    const separator = '<span class="breadcrumb-separator">/</span>';
    
    // 根据当前标题的级别，构建完整的路径
    if (currentHeading.level >= 1) {
        // 找到当前标题在列表中的位置
        const currentIndex = floatingTocHeadings.findIndex(h => h.id === currentHeading.id);
        if (currentIndex !== -1) {
            // 构建层级路径数组
            const pathHeadings = [];
            
            // 首先，找到所有可能的上级标题
            for (let level = 1; level <= currentHeading.level; level++) {
                // 从当前位置向前查找这个级别的最近标题
                for (let i = currentIndex; i >= 0; i--) {
                    const heading = floatingTocHeadings[i];
                    if (heading.level === level) {
                        // 如果是当前标题或者是上级标题，添加到路径中
                        if (level === currentHeading.level && heading.id === currentHeading.id) {
                            pathHeadings.push(heading);
                            break;
                        } else if (level < currentHeading.level) {
                            pathHeadings.push(heading);
                            break;
                        }
                    }
                }
            }
            
            // 按级别排序确保顺序正确
            pathHeadings.sort((a, b) => a.level - b.level);
            
            // 优先保证靠后的显示 - 如果路径过长，从后往前截取
            let displayHeadings = pathHeadings;
            const maxLength = 60; // 最大字符长度
            
            // 计算总长度
            let totalLength = displayHeadings.reduce((sum, heading) => sum + heading.text.length, 0);
            
            // 如果总长度超过限制，优先保留靠后的标题
            if (totalLength > maxLength && displayHeadings.length > 1) {
                // 从后往前保留标题，直到长度合适
                let currentLength = 0;
                const reversedHeadings = [...displayHeadings].reverse();
                displayHeadings = [];
                
                for (const heading of reversedHeadings) {
                    const headingLength = heading.text.length;
                    if (currentLength + headingLength <= maxLength) {
                        displayHeadings.unshift(heading);
                        currentLength += headingLength;
                    } else {
                        // 如果还有空间且没有任何标题，至少显示当前标题的截断版本
                        if (displayHeadings.length === 0) {
                            const truncatedText = heading.text.substring(0, maxLength - 3) + '...';
                            displayHeadings.unshift({ ...heading, text: truncatedText });
                        }
                        break;
                    }
                }
                
                // 如果截取了标题，在前面加上省略号
                if (displayHeadings.length < pathHeadings.length) {
                    displayHeadings.unshift({ text: '...', level: 0, id: 'ellipsis' });
                }
            }
            
            // 构建最终路径
            let breadcrumbPath = '';
            displayHeadings.forEach((heading, index) => {
                if (index > 0) breadcrumbPath += separator;
                
                const headingText = heading.text.length > 20 ? heading.text.substring(0, 20) + '...' : heading.text;
                const colorClass = heading.id === 'ellipsis' ? 'var(--text-tertiary)' : 'var(--primary-color)';
                breadcrumbPath += `<span style="color: ${colorClass};">${headingText}</span>`;
            });
            
            return breadcrumbPath;
        }
    }
    
    return '';
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
            id = `heading-${level}-${index}`;
            heading.id = id;
        }
        
        floatingTocHeadings.push({ level, text, id });
    });
    
    console.log('Initialized TOC with headings:', floatingTocHeadings);
    
    // Build floating TOC HTML
    buildFloatingToc();
    
    // Update scroll spy
    updateFloatingTocScrollSpy();
    
    // Update floating header breadcrumb
    const floatingHeader = document.getElementById('floatingHeader');
    if (floatingHeader && floatingHeader._updateBreadcrumb) {
        setTimeout(() => {
            floatingHeader._updateBreadcrumb();
        }, 100);
    }
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
        // 如果scroll spy被暂停（目录展开时），不执行滚动监听
        if (scrollSpyPaused) {
            return;
        }
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        let newActiveHeading = null;
        
        // 检查页面是否滚动到顶部（在第一个标题之前）
        const firstHeading = document.getElementById(floatingTocHeadings[0].id);
        if (firstHeading) {
            const firstHeadingTop = firstHeading.offsetTop;
            const offset = 150; // 增加偏移量，确保标题完全进入视口才激活
            
            // 如果滚动位置在第一个标题之前，不显示任何活跃标题
            if (scrollTop + offset < firstHeadingTop) {
                newActiveHeading = null;
            } else {
                // 遍历所有标题，找到当前可见的标题
                for (let i = 0; i < floatingTocHeadings.length; i++) {
                    const heading = document.getElementById(floatingTocHeadings[i].id);
                    if (heading) {
                        const headingTop = heading.offsetTop;
                        
                        // 如果当前滚动位置超过了这个标题
                        if (scrollTop + offset >= headingTop) {
                            newActiveHeading = floatingTocHeadings[i].id;
                            
                            // 检查是否有下一个标题，如果当前位置还没到下一个标题，就继续使用当前标题
                            if (i < floatingTocHeadings.length - 1) {
                                const nextHeading = document.getElementById(floatingTocHeadings[i + 1].id);
                                if (nextHeading && scrollTop + offset < nextHeading.offsetTop) {
                                    break; // 找到了当前标题，停止查找
                                }
                            } else {
                                // 这是最后一个标题
                                break;
                            }
                        }
                    }
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
                if (floatingBreadcrumb) {
                    if (currentActiveHeading) {
                        const heading = floatingTocHeadings.find(h => h.id === currentActiveHeading);
                        if (heading) {
                            const breadcrumbPath = buildBreadcrumbPath(heading);
                            floatingBreadcrumb.innerHTML = breadcrumbPath;
                        }
                    } else {
                        floatingBreadcrumb.innerHTML = '';
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
    
    // 保存当前滚动位置
    scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    
    // 暂停scroll spy逻辑
    scrollSpyPaused = true;
    
    // 禁用页面滚动 - 多重机制确保在所有设备上生效
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollPosition}px`;
    document.body.style.width = '100%';
    
    // 阻止触摸滚动（移动端）
    const preventScroll = (e) => {
        // 允许目录内部的滚动
        if (e.target.closest('#floatingToc')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    };
    
    // 添加触摸事件监听
    document.addEventListener('touchmove', preventScroll, { passive: false });
    document.addEventListener('wheel', preventScroll, { passive: false });
    
    // 将阻止函数存储到floatingToc元素上，以便后续移除
    floatingToc._preventScroll = preventScroll;
    
    floatingToc.classList.add('visible');
    floatingTocVisible = true;
    
    // 初始化滚动监听器以控制毛玻璃遮罩
    setupTocScrollListener();
    
    // 添加键盘事件监听
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            hideFloatingToc();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // 将键盘监听器存储到floatingToc元素上，以便后续移除
    floatingToc._handleKeyDown = handleKeyDown;
}

/**
 * Setup scroll listener for TOC content to control gradient masks
 */
function setupTocScrollListener() {
    const tocContent = document.querySelector('.floating-toc-content');
    if (!tocContent) return;
    
    // 检查滚动状态并更新遮罩显示
    const updateScrollMasks = () => {
        const scrollTop = tocContent.scrollTop;
        const scrollHeight = tocContent.scrollHeight;
        const clientHeight = tocContent.clientHeight;
        const scrollBottom = scrollHeight - scrollTop - clientHeight;
        
        // 顶部遮罩：滚动超过20px时显示
        if (scrollTop > 20) {
            tocContent.classList.add('scrolled');
        } else {
            tocContent.classList.remove('scrolled');
        }
        
        // 底部遮罩：距离底部20px以上时显示
        if (scrollBottom > 20) {
            tocContent.classList.add('scrolled-bottom');
        } else {
            tocContent.classList.remove('scrolled-bottom');
        }
    };
    
    // 初始检查
    setTimeout(updateScrollMasks, 100);
    
    // 添加滚动监听器
    const scrollHandler = () => {
        requestAnimationFrame(updateScrollMasks);
    };
    
    tocContent.addEventListener('scroll', scrollHandler, { passive: true });
    
    // 存储监听器引用以便清理
    tocContent._scrollHandler = scrollHandler;
}

/**
 * Hide floating TOC with enhanced closing animation
 */
function hideFloatingToc() {
    const floatingToc = document.getElementById('floatingToc');
    if (!floatingToc || !floatingTocVisible) return;
    
    // 清理滚动监听器
    const tocContent = document.querySelector('.floating-toc-content');
    if (tocContent && tocContent._scrollHandler) {
        tocContent.removeEventListener('scroll', tocContent._scrollHandler);
        delete tocContent._scrollHandler;
        // 重置遮罩状态
        tocContent.classList.remove('scrolled', 'scrolled-bottom');
    }
    
    // 添加关闭动画类
    floatingToc.classList.add('closing');
    
    // 延迟移除可见性，让关闭动画完成
    setTimeout(() => {
        floatingToc.classList.remove('visible');
        floatingToc.classList.remove('closing');
        floatingTocVisible = false;
        
        // 恢复scroll spy逻辑
        scrollSpyPaused = false;
        
        // 移除事件监听器
        if (floatingToc._preventScroll) {
            document.removeEventListener('touchmove', floatingToc._preventScroll);
            document.removeEventListener('wheel', floatingToc._preventScroll);
            delete floatingToc._preventScroll;
        }
        
        if (floatingToc._handleKeyDown) {
            document.removeEventListener('keydown', floatingToc._handleKeyDown);
            delete floatingToc._handleKeyDown;
        }
        
        // 恢复页面滚动状态
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        // 恢复到之前的滚动位置
        window.scrollTo(0, scrollPosition);
        
    }, 300); // 与CSS动画时间匹配
}

/**
 * Scroll to specific heading with enhanced animation
 */
function scrollToHeading(headingId) {
    console.log('Scrolling to heading:', headingId);
    const heading = document.getElementById(headingId);
    if (heading) {
        // 先隐藏目录（这会恢复滚动状态）
        hideFloatingToc();
        
        // 延迟滚动，让目录动画完成并且滚动状态恢复
        setTimeout(() => {
            // 使用 offsetTop 获取准确的位置
            const headingTop = heading.offsetTop;
            const offset = 100; // Account for floating header
            const targetPosition = headingTop - offset;
            
            console.log('Target scroll position:', targetPosition);
            
            // 暂停scroll spy，避免在滚动动画期间的干扰
            scrollSpyPaused = true;
            
            // 使用更平滑的缓动函数进行滚动
            const startPosition = window.pageYOffset;
            const distance = Math.max(0, targetPosition) - startPosition;
            const duration = Math.min(1000, Math.max(500, Math.abs(distance) * 0.5)); // 动态计算时长
            let startTime = null;
            
            function easeInOutCubic(t) {
                return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            }
            
            function animateScroll(currentTime) {
                if (startTime === null) startTime = currentTime;
                const timeElapsed = currentTime - startTime;
                const progress = Math.min(timeElapsed / duration, 1);
                const easedProgress = easeInOutCubic(progress);
                
                window.scrollTo(0, startPosition + distance * easedProgress);
                
                if (progress < 1) {
                    requestAnimationFrame(animateScroll);
                } else {
                    // 动画完成后的处理
                    scrollSpyPaused = false; // 恢复scroll spy
                    completeScrollAnimation(headingId);
                }
            }
            
            requestAnimationFrame(animateScroll);
        }, 350); // 稍微延长延迟，确保TOC关闭动画完全完成
    } else {
        console.warn('Heading not found:', headingId);
    }
}

/**
 * Complete scroll animation and update UI
 */
function completeScrollAnimation(headingId) {
    // 更新URL hash
    window.history.replaceState(null, null, `#${headingId}`);
    
    // 强制更新当前活跃标题
    setTimeout(() => {
        currentActiveHeading = headingId;
        
        // 更新 TOC 中的活跃状态
        const tocLinks = document.querySelectorAll('#floatingTocList a');
        tocLinks.forEach(link => {
            const linkClass = link.className;
            if (link.getAttribute('href') === `#${headingId}`) {
                link.classList.add('active');
                // 添加短暂的高亮效果
                link.style.transform = 'translateY(-2px) scale(1.02)';
                setTimeout(() => {
                    link.style.transform = '';
                }, 300);
            } else {
                link.classList.remove('active');
            }
        });
        
        // 更新面包屑
        if (floatingHeaderVisible) {
            const floatingBreadcrumb = document.getElementById('floatingBreadcrumb');
            if (floatingBreadcrumb) {
                const heading = floatingTocHeadings.find(h => h.id === headingId);
                if (heading) {
                    const breadcrumbPath = buildBreadcrumbPath(heading);
                    floatingBreadcrumb.innerHTML = breadcrumbPath;
                }
            }
        }
    }, 100);
}

/**
 * Handle URL fragment on page load
 */
function handleUrlFragment() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#')) {
        const headingId = hash.substring(1);
        console.log('URL fragment detected:', headingId);
        
        // 延迟处理，确保页面内容已加载
        setTimeout(() => {
            const heading = document.getElementById(headingId);
            if (heading) {
                console.log('Found heading for fragment, scrolling to:', headingId);
                scrollToHeading(headingId);
            } else {
                console.warn('Heading not found for fragment:', headingId);
                // 如果标题不存在，尝试去掉fragment前缀重新查找
                const alternativeId = headingId.replace(/^heading-/, '');
                const alternativeHeading = document.getElementById(alternativeId);
                if (alternativeHeading) {
                    console.log('Found alternative heading:', alternativeId);
                    scrollToHeading(alternativeId);
                }
            }
        }, 1000); // 增加延迟确保内容完全加载
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
                    handleUrlFragment(); // Handle URL fragment after page load
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
                handleUrlFragment(); // Handle URL fragment after initial page load
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
    window.initFloatingToc = initFloatingToc;
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