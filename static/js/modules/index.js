// Main entry point for Notion page renderer
import * as Core from './core.js';
import * as Loader from './loader.js';
import * as ImageHandler from './imageHandler.js';
// Modal functions are loaded globally via script tag
import * as Utils from './utils.js';
import * as NotionRenderer from './notionRenderer.js';

// Floating header management
let floatingHeaderVisible = false;
let lastScrollTop = 0;
let scrollHandlingPaused = false; // 标记是否暂停scroll处理
let isInitializing = true; // 标记是否正在初始化

// Floating TOC management
let floatingTocVisible = false;
let floatingTocHeadings = [];
let currentActiveHeading = null;
let scrollPosition = 0; // 保存滚动位置
let scrollSpyPaused = false; // 标记是否暂停scroll spy

/**
 * Initialize dynamic header scroll behavior
 */
function initFloatingHeader() {
    const dynamicHeader = document.getElementById('dynamicHeader');
    const floatingTitle = document.getElementById('floatingTitle');
    const floatingBreadcrumb = document.getElementById('floatingBreadcrumb');
    // 页面标题现在从动态头部获取，而不是页面内容中
    
    if (!dynamicHeader || !floatingTitle) return;
    
    // Update floating title when page title changes
    const updateFloatingTitle = (title) => {
        if (title) {
            floatingTitle.textContent = title;
        }
    };
    
    // Update breadcrumb based on current heading
    const updateBreadcrumb = (animated = true) => {
        if (!floatingBreadcrumb) return;
        
        // 初始化时禁用动画
        if (isInitializing) {
            animated = false;
        }
        
        if (floatingTocHeadings.length === 0) {
            // 没有标题时，隐藏面包屑并禁用点击
            floatingBreadcrumb.style.display = 'none';
            dynamicHeader.style.cursor = 'default';
            dynamicHeader.removeAttribute('title');
            dynamicHeader.removeAttribute('aria-label');
            // 移除内联onclick，因为我们会用事件监听器
            dynamicHeader.removeAttribute('onclick');
        } else {
            // 有标题时，显示面包屑和启用点击
            floatingBreadcrumb.style.display = 'block';
            dynamicHeader.style.cursor = 'pointer';
            dynamicHeader.setAttribute('title', '点击查看目录');
            dynamicHeader.setAttribute('aria-label', '点击查看目录');
            // 确保点击事件正常工作，使用事件监听器而不是内联onclick
            dynamicHeader.onclick = function(event) {
                // 阻止默认行为和事件冒泡
                event.preventDefault();
                event.stopPropagation();
                
                // 暂停scroll处理，避免点击时触发scroll事件
                scrollHandlingPaused = true;
                
                // 调用目录切换函数
                if (typeof toggleFloatingToc === 'function') {
                    toggleFloatingToc();
                } else if (typeof window.toggleFloatingToc === 'function') {
                    window.toggleFloatingToc();
                }
                
                // 延迟恢复scroll处理，确保点击事件完全处理完毕
                setTimeout(() => {
                    scrollHandlingPaused = false;
                }, 500);
            };
            
            if (currentActiveHeading) {
                const heading = floatingTocHeadings.find(h => h.id === currentActiveHeading);
                if (heading) {
                    // 章节切换时的动画效果
                    if (animated && floatingBreadcrumb.innerHTML && floatingBreadcrumb.classList.contains('visible')) {
                        const newBreadcrumbPath = buildBreadcrumbPath(heading);
                        
                        // 只有当内容真的变化时才执行动画
                        if (floatingBreadcrumb.innerHTML !== newBreadcrumbPath) {
                            // 先淡出旧内容
                            floatingBreadcrumb.classList.add('changing');
                            floatingBreadcrumb.classList.remove('visible');
                            
                            setTimeout(() => {
                                // 更新内容并淡入新内容
                                floatingBreadcrumb.innerHTML = newBreadcrumbPath;
                                floatingBreadcrumb.classList.remove('changing');
                                
                                // 移动端动态调整标题宽度
                                adjustMobileTitleWidth();
                                
                                setTimeout(() => {
                                    floatingBreadcrumb.classList.add('visible');
                                }, 50);
                            }, 200);
                        }
                    } else {
                        // 初次显示或无动画模式
                        const breadcrumbPath = buildBreadcrumbPath(heading);
                        floatingBreadcrumb.innerHTML = breadcrumbPath;
                        
                        // 移动端动态调整标题宽度
                        adjustMobileTitleWidth();
                        
                        setTimeout(() => {
                            floatingBreadcrumb.classList.add('visible');
                        }, 100);
                    }
                } else {
                    floatingBreadcrumb.classList.remove('visible');
                    setTimeout(() => {
                        floatingBreadcrumb.innerHTML = '';
                    }, 300);
                }
            } else {
                floatingBreadcrumb.classList.remove('visible');
                setTimeout(() => {
                    floatingBreadcrumb.innerHTML = '';
                }, 300);
            }
        }
    };
    
    // 页面标题将通过API获取后直接设置
    // 不再需要监听页面内的标题变化
    
    // Scroll event handler
    const handleScroll = () => {
        // 如果scroll处理被暂停，直接返回
        if (scrollHandlingPaused) {
            return;
        }
        
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollThreshold = 150; // 滚动150px后开始缩小
        
        // 根据滚动距离动态调整头部样式
        if (currentScrollTop > scrollThreshold) {
            // 滚动超过阈值，显示小标题样式
            if (!floatingHeaderVisible) {
                dynamicHeader.classList.remove('large');
                dynamicHeader.classList.add('small');
                floatingHeaderVisible = true;
                // 只在非初始化状态时更新面包屑
                if (!isInitializing) {
                    updateBreadcrumb(); // 切换时更新面包屑
                }
            }
        } else {
            // 滚动在阈值内，显示大标题样式
            if (floatingHeaderVisible) {
                dynamicHeader.classList.remove('small');
                dynamicHeader.classList.add('large');
                floatingHeaderVisible = false;
                hideFloatingToc(); // 切换到大标题时关闭目录
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
    dynamicHeader._updateBreadcrumb = updateBreadcrumb;
    dynamicHeader._updateTitle = updateFloatingTitle;
    
    // Listen for window resize to update breadcrumb on orientation change
    let resizeTimeout;
    window.addEventListener('resize', () => {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
            updateBreadcrumb(false); // 屏幕旋转时不需要动画
            adjustMobileTitleWidth(); // 调整移动端标题宽度
        }, 100);
    }, { passive: true });
    
    // Initial check
    setTimeout(() => {
        handleScroll();
        updateBreadcrumb();
        // 延迟更长时间确保DOM完全稳定后才启用动画
        setTimeout(() => {
            isInitializing = false;
        }, 500);
    }, 100);
}

/**
 * Adjust mobile title width based on breadcrumb space requirements
 */
function adjustMobileTitleWidth() {
    const isMobile = window.innerWidth <= 640;
    if (!isMobile) return;
    
    const dynamicHeader = document.getElementById('dynamicHeader');
    const floatingTitle = document.getElementById('floatingTitle');
    const floatingBreadcrumb = document.getElementById('floatingBreadcrumb');
    
    if (!dynamicHeader || !floatingTitle || !floatingBreadcrumb) return;
    
    // 只在小标题状态时调整
    if (!floatingHeaderVisible) return;
    
    // 获取容器和面包屑宽度
    const headerWidth = dynamicHeader.offsetWidth;
    const padding = 40; // 左右内边距
    const gap = 12; // 标题和面包屑之间的间距
    const availableWidth = headerWidth - padding * 2;
    
    // 测量面包屑的实际宽度
    const breadcrumbWidth = floatingBreadcrumb.offsetWidth;
    
    // 计算标题可用宽度
    const titleAvailableWidth = availableWidth - breadcrumbWidth - gap;
    
    // 设置标题的最大宽度
    if (titleAvailableWidth > 0) {
        floatingTitle.style.maxWidth = `${titleAvailableWidth}px`;
    } else {
        // 如果空间不足，给标题设置最小宽度
        const minTitleWidth = Math.max(100, availableWidth * 0.4);
        floatingTitle.style.maxWidth = `${minTitleWidth}px`;
    }
}

/**
 * Build breadcrumb path for current heading
 */
function buildBreadcrumbPath(currentHeading) {
    if (!currentHeading) return '';
    
    // 检测是否为移动端
    const isMobile = window.innerWidth <= 640;
    const separator = '<span class="breadcrumb-separator">/</span>';
    
    // 移动端优化：动态计算可用空间
    if (isMobile) {
        const dynamicHeader = document.getElementById('dynamicHeader');
        const floatingTitle = document.getElementById('floatingTitle');
        
        if (dynamicHeader && floatingTitle) {
            // 获取头部容器的宽度
            const headerWidth = dynamicHeader.offsetWidth;
            const padding = 40; // 左右内边距
            const gap = 12; // 标题和面包屑之间的间距
            const availableWidth = headerWidth - padding * 2;
            
            // 测量标题的实际宽度
            const titleText = floatingTitle.textContent;
            const titleMeasureSpan = document.createElement('span');
            titleMeasureSpan.style.cssText = `
                position: absolute;
                visibility: hidden;
                font-size: 1rem;
                font-weight: 600;
                line-height: 1.4;
                white-space: nowrap;
            `;
            titleMeasureSpan.textContent = titleText;
            document.body.appendChild(titleMeasureSpan);
            const titleWidth = titleMeasureSpan.offsetWidth;
            document.body.removeChild(titleMeasureSpan);
            
            // 计算面包屑可用宽度
            const breadcrumbAvailableWidth = availableWidth - titleWidth - gap;
            
            // 根据可用宽度决定显示内容
            let headingText = currentHeading.text;
            const minBreadcrumbWidth = 80; // 最小面包屑宽度
            
            if (breadcrumbAvailableWidth >= minBreadcrumbWidth) {
                // 有足够空间显示面包屑
                const charWidth = 8; // 估算字符宽度（px）
                const maxChars = Math.floor(breadcrumbAvailableWidth / charWidth);
                
                if (headingText.length > maxChars) {
                    headingText = headingText.substring(0, maxChars - 1) + '…';
                }
                
                return `<span style="color: var(--primary-color); font-weight: 600;">${headingText}</span>`;
            } else {
                // 空间不足，可能需要缩短标题为面包屑让路
                const titleMaxWidth = availableWidth - minBreadcrumbWidth - gap;
                if (titleWidth > titleMaxWidth) {
                    // 标题需要截断，但这里只返回面包屑内容
                    // 标题的截断由CSS处理
                    const charWidth = 8;
                    const maxChars = Math.floor(minBreadcrumbWidth / charWidth);
                    
                    if (headingText.length > maxChars) {
                        headingText = headingText.substring(0, maxChars - 1) + '…';
                    }
                    
                    return `<span style="color: var(--primary-color); font-weight: 600;">${headingText}</span>`;
                }
            }
        }
        
        // 默认移动端处理（当无法测量时）
        let headingText = currentHeading.text;
        const maxMobileLength = 20; // 保守的默认长度
        
        if (headingText.length > maxMobileLength) {
            headingText = headingText.substring(0, maxMobileLength - 1) + '…';
        }
        
        return `<span style="color: var(--primary-color); font-weight: 600;">${headingText}</span>`;
    }
    
    // 桌面端显示完整层级路径
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
            
            // 优先保证最深层级（当前）标题的显示
            let displayHeadings = pathHeadings;
            const maxTotalLength = 100; // 增加最大总字符长度
            const maxHeadingLength = 35; // 增加单个标题最大长度
            
            // 计算显示策略：优先保证当前标题（最深层级）完整显示
            if (displayHeadings.length > 1) {
                const currentHeadingIndex = displayHeadings.length - 1;
                const currentHeadingText = displayHeadings[currentHeadingIndex].text;
                
                // 为当前标题预留足够空间
                const reservedLength = Math.min(currentHeadingText.length, maxHeadingLength);
                const availableLength = maxTotalLength - reservedLength - 6; // 预留省略号和分隔符空间
                
                // 从后往前（从当前标题开始）选择要显示的标题
                let selectedHeadings = [displayHeadings[currentHeadingIndex]];
                let usedLength = reservedLength;
                
                // 从倒数第二个标题开始向前选择
                for (let i = currentHeadingIndex - 1; i >= 0; i--) {
                    const heading = displayHeadings[i];
                    const headingLength = Math.min(heading.text.length, maxHeadingLength);
                    const separatorLength = 3; // " / " 分隔符的长度
                    
                    if (usedLength + headingLength + separatorLength <= maxTotalLength) {
                        selectedHeadings.unshift(heading);
                        usedLength += headingLength + separatorLength;
                    } else {
                        // 空间不够，如果还有更多上级标题，添加省略号
                        if (i > 0) {
                            selectedHeadings.unshift({ text: '...', level: 0, id: 'ellipsis' });
                        }
                        break;
                    }
                }
                
                displayHeadings = selectedHeadings;
            }
            
            // 构建最终路径，对每个标题应用长度限制
            let breadcrumbPath = '';
            displayHeadings.forEach((heading, index) => {
                if (index > 0) breadcrumbPath += separator;
                
                let headingText = heading.text;
                
                // 为当前标题（最后一个）提供更大的显示空间
                const isCurrentHeading = index === displayHeadings.length - 1;
                const maxLength = isCurrentHeading ? maxHeadingLength : Math.min(maxHeadingLength, 25);
                
                // 应用长度限制
                if (headingText.length > maxLength) {
                    headingText = headingText.substring(0, maxLength - 1) + '…';
                }
                
                const colorClass = heading.id === 'ellipsis' ? 'var(--text-tertiary)' : 
                                 isCurrentHeading ? 'var(--primary-color)' : 'var(--text-secondary)';
                const fontWeight = isCurrentHeading ? 'font-weight: 600;' : 'font-weight: 400;';
                
                breadcrumbPath += `<span style="color: ${colorClass}; ${fontWeight}">${headingText}</span>`;
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
        const floatingHeader = document.getElementById('dynamicHeader');
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
            
            // Update breadcrumb if floating header is visible with animation
            if (floatingHeaderVisible) {
                const floatingHeader = document.getElementById('dynamicHeader');
                if (floatingHeader && floatingHeader._updateBreadcrumb) {
                    // 只在非初始化状态时启用动画
                    floatingHeader._updateBreadcrumb(!isInitializing); // 初始化时禁用章节切换动画
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
    // 暂停scroll spy逻辑和scroll处理逻辑
    scrollSpyPaused = true;
    scrollHandlingPaused = true;
    
    // 在DOM状态改变前先计算当前活跃章节
    updateCurrentActiveHeadingBeforeFixedPosition();
    
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
    
    // 高亮当前活跃章节
    highlightCurrentActiveHeading();
    
    floatingToc.classList.add('visible');
    floatingTocVisible = true;
    
    // 等待目录完全展开后再设置滚动位置和视觉效果
    setTimeout(() => {
        if (currentActiveHeading) {
            const activeTocLink = document.querySelector(`#floatingTocList a[href="#${currentActiveHeading}"]`);
            const tocContent = document.querySelector('.floating-toc-content');
            
            if (activeTocLink && tocContent) {
                // 等待一帧确保DOM完全渲染
                requestAnimationFrame(() => {
                    // 计算目标滚动位置，将当前章节居中显示
                    const activeLinkTop = activeTocLink.offsetTop;
                    const activeLinkHeight = activeTocLink.offsetHeight;
                    const contentHeight = tocContent.clientHeight;
                    
                    const targetScroll = activeLinkTop - (contentHeight / 2) + (activeLinkHeight / 2);
                    
                    // 立即设置滚动位置，确保当前章节居中
                    tocContent.scrollTop = Math.max(0, targetScroll);
                    
                    // 添加视觉强调效果
                    activeTocLink.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    activeTocLink.style.transform = 'translateY(-2px) scale(1.02)';
                    activeTocLink.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1)';
                    
                    // 恢复正常状态
                    setTimeout(() => {
                        activeTocLink.style.transform = '';
                        activeTocLink.style.boxShadow = '';
                    }, 600);
                });
            }
        }
    }, 400); // 增加等待时间，确保目录展开动画完全完成
    
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
 * Update current active heading before DOM position changes (for TOC centering)
 */
function updateCurrentActiveHeadingBeforeFixedPosition() {
    if (floatingTocHeadings.length === 0) {
        return;
    }
    
    let newActiveHeading = null;
    const scrollTop = scrollPosition; // 使用保存的滚动位置
    const offset = 150;
    
    // 遍历所有标题，找到当前位置对应的标题
    for (let i = 0; i < floatingTocHeadings.length; i++) {
        const heading = document.getElementById(floatingTocHeadings[i].id);
        if (heading) {
            const headingTop = heading.offsetTop;
            
            if (scrollTop + offset >= headingTop) {
                newActiveHeading = floatingTocHeadings[i].id;
                
                // 检查是否有下一个标题
                if (i < floatingTocHeadings.length - 1) {
                    const nextHeading = document.getElementById(floatingTocHeadings[i + 1].id);
                    if (nextHeading) {
                        const nextHeadingTop = nextHeading.offsetTop;
                        if (scrollTop + offset < nextHeadingTop) {
                            break;
                        }
                    }
                } else {
                    break;
                }
            }
        }
    }
    
    currentActiveHeading = newActiveHeading;
}

/**
 * Update current active heading based on saved scroll position
 */
function updateCurrentActiveHeading() {
    if (floatingTocHeadings.length === 0) return;
    
    let newActiveHeading = null;
    const scrollTop = scrollPosition; // 使用保存的滚动位置
    
    // 检查页面是否滚动到顶部（在第一个标题之前）
    const firstHeading = document.getElementById(floatingTocHeadings[0].id);
    if (firstHeading) {
        const firstHeadingTop = firstHeading.offsetTop;
        const offset = 150;
        
        if (scrollTop + offset >= firstHeadingTop) {
            // 遍历所有标题，找到当前位置对应的标题
            for (let i = 0; i < floatingTocHeadings.length; i++) {
                const heading = document.getElementById(floatingTocHeadings[i].id);
                if (heading) {
                    const headingTop = heading.offsetTop;
                    
                    if (scrollTop + offset >= headingTop) {
                        newActiveHeading = floatingTocHeadings[i].id;
                        
                        // 检查是否有下一个标题
                        if (i < floatingTocHeadings.length - 1) {
                            const nextHeading = document.getElementById(floatingTocHeadings[i + 1].id);
                            if (nextHeading && scrollTop + offset < nextHeading.offsetTop) {
                                break;
                            }
                        } else {
                            break;
                        }
                    }
                }
            }
        }
    }
    
    currentActiveHeading = newActiveHeading;
}

/**
 * Highlight current active heading in TOC
 */
function highlightCurrentActiveHeading() {
    const tocLinks = document.querySelectorAll('#floatingTocList a');
    tocLinks.forEach(link => {
        if (currentActiveHeading && link.getAttribute('href') === `#${currentActiveHeading}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

/**
 * Scroll to active heading in TOC list with smooth animation
 * Used for dynamic updates when TOC is already visible
 */
function scrollToActiveHeadingInToc() {
    if (!currentActiveHeading || !floatingTocVisible) return;
    
    const activeTocLink = document.querySelector(`#floatingTocList a[href="#${currentActiveHeading}"]`);
    if (!activeTocLink) return;
    
    const tocContent = document.querySelector('.floating-toc-content');
    if (!tocContent) return;
    
    // 计算需要滚动的位置
    const linkRect = activeTocLink.getBoundingClientRect();
    const contentRect = tocContent.getBoundingClientRect();
    
    // 目标位置：将当前章节滚动到目录容器的中央
    const targetScroll = activeTocLink.offsetTop - (contentRect.height / 2) + (linkRect.height / 2);
    
    // 平滑滚动到目标位置
    tocContent.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
    });
}

/**
 * Hide floating TOC with enhanced closing animation
 */
function hideFloatingToc() {
    const floatingToc = document.getElementById('floatingToc');
    if (!floatingToc || !floatingTocVisible) return;
    
    // 添加关闭动画类
    floatingToc.classList.add('closing');
    
    // 延迟移除可见性，让关闭动画完成
    setTimeout(() => {
        floatingToc.classList.remove('visible');
        floatingToc.classList.remove('closing');
        floatingTocVisible = false;
        
        // 恢复scroll spy逻辑
        scrollSpyPaused = false;
        
        // 恢复scroll处理逻辑
        scrollHandlingPaused = false;
        
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
            
            // 暂停scroll spy和scroll处理，避免在滚动动画期间的干扰
            scrollSpyPaused = true;
            scrollHandlingPaused = true;
            
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
                    scrollHandlingPaused = false; // 恢复scroll处理
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
                    // 添加显示动画
                    setTimeout(() => {
                        floatingBreadcrumb.classList.add('visible');
                    }, 100);
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
    if (typeof initModalEventListeners === 'function') {
        initModalEventListeners();
    }
    
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
    window.openImageModal = typeof openImageModal !== 'undefined' ? openImageModal : null;
    window.closeImageModal = typeof closeImageModal !== 'undefined' ? closeImageModal : null;
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