// 块间距调试工具
(function() {
    'use strict';
    
    let debugMode = false;
    let blockCounter = 0;
    let spacingMeasurements = [];
    let contentObserver = null;
    let refreshTimeout = null;
    
    // 创建调试按钮
    function createDebugButton() {
        const button = document.createElement('button');
        button.textContent = '调试间距';
        button.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            padding: 8px 12px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: bold;
        `;
        
        button.addEventListener('click', toggleDebugMode);
        document.body.appendChild(button);
        return button;
    }
    
    // 切换调试模式
    function toggleDebugMode() {
        debugMode = !debugMode;
        const buttons = document.querySelectorAll('button');
        const button = Array.from(buttons).find(btn => btn.textContent.includes('调试间距') || btn.textContent.includes('关闭调试'));
        
        if (debugMode) {
            button.textContent = '关闭调试';
            button.style.background = '#10b981';
            startDebugging();
            
            // 持续监控内容变化
            startContentMonitoring();
        } else {
            button.textContent = '调试间距';
            button.style.background = '#ef4444';
            stopDebugging();
            stopContentMonitoring();
        }
    }
    
    // 开始调试
    function startDebugging() {
        // 为页面内容中的所有直接子元素添加编号和间距测量
        const pageContent = document.getElementById('pageContent');
        if (!pageContent) {
            console.warn('未找到页面内容容器');
            return;
        }
        
        const elements = Array.from(pageContent.children);
        blockCounter = 0;
        spacingMeasurements = [];
        
        elements.forEach((element, index) => {
            if (element.id === 'background-loading') return; // 跳过加载指示器
            
            blockCounter++;
            
            // 添加块编号标识
            const indicator = document.createElement('div');
            indicator.className = 'debug-block-indicator';
            indicator.textContent = `${blockCounter}`;
            indicator.style.cssText = `
                position: absolute;
                left: -2rem;
                top: 0;
                background: #3b82f6;
                color: white;
                padding: 0.25rem 0.5rem;
                font-size: 0.75rem;
                border-radius: 0.25rem;
                font-weight: bold;
                z-index: 1000;
                pointer-events: none;
            `;
            
            // 确保元素有相对定位以便定位指示器
            if (getComputedStyle(element).position === 'static') {
                element.style.position = 'relative';
                element.dataset.debugOriginalPosition = 'static';
            }
            
            element.appendChild(indicator);
            element.dataset.debugBlockNumber = blockCounter;
            
            // 测量与前一个元素的间距
            if (index > 0) {
                const prevElement = elements[index - 1];
                if (prevElement.id !== 'background-loading') {
                    const spacing = measureSpacingBetween(prevElement, element);
                    spacingMeasurements.push({
                        from: prevElement.dataset.debugBlockNumber,
                        to: blockCounter,
                        spacing: spacing,
                        elements: [prevElement, element]
                    });
                    
                    // 特别标记第15-16块或16-17块之间的间距
                    if ((prevElement.dataset.debugBlockNumber === '15' && blockCounter === 16) ||
                        (prevElement.dataset.debugBlockNumber === '16' && blockCounter === 17)) {
                        highlightSpacing(prevElement, element, spacing, `块${prevElement.dataset.debugBlockNumber}-${blockCounter}`);
                    }
                }
            }
            
            // 添加CSS类标识
            const classes = Array.from(element.classList);
            if (classes.length > 0) {
                const classIndicator = document.createElement('div');
                classIndicator.className = 'debug-class-indicator';
                classIndicator.textContent = classes.join(' ');
                classIndicator.style.cssText = `
                    position: absolute;
                    right: -1rem;
                    top: 0;
                    background: #f59e0b;
                    color: white;
                    padding: 0.125rem 0.375rem;
                    font-size: 0.625rem;
                    border-radius: 0.25rem;
                    font-weight: bold;
                    z-index: 1000;
                    pointer-events: none;
                    max-width: 200px;
                    word-break: break-all;
                `;
                element.appendChild(classIndicator);
            }
        });
        
        // 输出测量结果
        console.group('📏 块间距测量结果');
        spacingMeasurements.forEach(measurement => {
            console.log(`块${measurement.from} -> 块${measurement.to}: ${measurement.spacing.toFixed(2)}px`);
        });
        console.groupEnd();
        
        // 查找异常间距
        const averageSpacing = spacingMeasurements.reduce((sum, m) => sum + m.spacing, 0) / spacingMeasurements.length;
        const abnormalSpacings = spacingMeasurements.filter(m => 
            Math.abs(m.spacing - averageSpacing) > averageSpacing * 0.5
        );
        
        if (abnormalSpacings.length > 0) {
            console.group('⚠️ 异常间距检测');
            console.log(`平均间距: ${averageSpacing.toFixed(2)}px`);
            abnormalSpacings.forEach(measurement => {
                console.warn(`异常间距 块${measurement.from} -> 块${measurement.to}: ${measurement.spacing.toFixed(2)}px (偏差: ${(measurement.spacing - averageSpacing).toFixed(2)}px)`);
                highlightSpacing(measurement.elements[0], measurement.elements[1], measurement.spacing, `异常间距 ${measurement.from}-${measurement.to}`);
            });
            console.groupEnd();
        }
    }
    
    // 测量两个元素之间的间距
    function measureSpacingBetween(element1, element2) {
        const rect1 = element1.getBoundingClientRect();
        const rect2 = element2.getBoundingClientRect();
        return rect2.top - rect1.bottom;
    }
    
    // 高亮显示间距
    function highlightSpacing(element1, element2, spacing, label) {
        const rect1 = element1.getBoundingClientRect();
        const rect2 = element2.getBoundingClientRect();
        
        const highlight = document.createElement('div');
        highlight.className = 'debug-spacing-highlight';
        highlight.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            height: ${Math.abs(spacing)}px;
            background: rgba(239, 68, 68, 0.3);
            border: 2px solid #ef4444;
            top: ${rect1.bottom + window.scrollY}px;
            z-index: 999;
            pointer-events: none;
        `;
        
        const labelEl = document.createElement('div');
        labelEl.textContent = `${label}: ${spacing.toFixed(2)}px`;
        labelEl.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #ef4444;
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: bold;
            white-space: nowrap;
        `;
        
        highlight.appendChild(labelEl);
        document.body.appendChild(highlight);
    }
    
    // 停止调试
    function stopDebugging() {
        // 移除所有调试元素
        document.querySelectorAll('.debug-block-indicator').forEach(el => el.remove());
        document.querySelectorAll('.debug-class-indicator').forEach(el => el.remove());
        document.querySelectorAll('.debug-spacing-highlight').forEach(el => el.remove());
        
        // 恢复原始position样式
        document.querySelectorAll('[data-debug-original-position]').forEach(el => {
            if (el.dataset.debugOriginalPosition === 'static') {
                el.style.position = '';
            }
            delete el.dataset.debugOriginalPosition;
            delete el.dataset.debugBlockNumber;
        });
    }
    
    // 页面加载完成后创建调试按钮
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createDebugButton);
    } else {
        createDebugButton();
    }
    
    // 内容监控功能
    function startContentMonitoring() {
        const pageContent = document.getElementById('pageContent');
        if (!pageContent) return;
        
        // 使用 MutationObserver 监控内容变化
        contentObserver = new MutationObserver((mutations) => {
            let hasNewContent = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // 检查是否有新的元素被添加
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && 
                            node.id !== 'background-loading' && 
                            !node.classList.contains('debug-block-indicator') &&
                            !node.classList.contains('debug-class-indicator') &&
                            !node.classList.contains('debug-spacing-highlight')) {
                            hasNewContent = true;
                        }
                    });
                }
            });
            
            if (hasNewContent) {
                // 延迟刷新，避免过于频繁的更新
                if (refreshTimeout) {
                    clearTimeout(refreshTimeout);
                }
                
                refreshTimeout = setTimeout(() => {
                    console.log('检测到新内容，刷新调试信息...');
                    stopDebugging();
                    startDebugging();
                }, 500);
            }
        });
        
        contentObserver.observe(pageContent, {
            childList: true,
            subtree: true
        });
        
        console.log('内容监控已启动');
    }
    
    function stopContentMonitoring() {
        if (contentObserver) {
            contentObserver.disconnect();
            contentObserver = null;
        }
        
        if (refreshTimeout) {
            clearTimeout(refreshTimeout);
            refreshTimeout = null;
        }
        
        console.log('内容监控已停止');
    }
    
    // 暴露到全局作用域以便调试
    window.debugSpacing = {
        toggle: toggleDebugMode,
        start: startDebugging,
        stop: stopDebugging,
        measurements: () => spacingMeasurements,
        refresh: () => {
            if (debugMode) {
                stopDebugging();
                startDebugging();
            }
        }
    };
})(); 