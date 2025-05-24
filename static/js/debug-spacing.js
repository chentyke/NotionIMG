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
        
        console.log(`🔍 开始调试，找到 ${elements.length} 个子元素`);
        elements.forEach(el => {
            console.log(`- 元素: ${el.tagName} ${el.className} ${el.id || '(无ID)'}`);
        });
        
        elements.forEach((element, index) => {
            // 跳过加载指示器，但记录跳过的原因
            if (element.id === 'background-loading') {
                console.log(`⏭️ 跳过加载指示器: ${element.id}`);
                return;
            }
            
            // 跳过调试元素本身
            if (element.className && (
                element.className.includes('debug-block-indicator') ||
                element.className.includes('debug-class-indicator') ||
                element.className.includes('debug-spacing-indicator') ||
                element.className.includes('debug-spacing-area') ||
                element.className.includes('debug-summary-info')
            )) {
                console.log(`⏭️ 跳过调试元素: ${element.className}`);
                return;
            }
            
            blockCounter++;
            
            console.log(`📦 处理块 ${blockCounter}: ${element.tagName} (index: ${index})`);
            
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
                // 找到前一个有效的块元素
                let prevElement = null;
                let prevBlockNumber = null;
                
                // 向前查找最近的有效块
                for (let i = index - 1; i >= 0; i--) {
                    const el = elements[i];
                    if (el.dataset.debugBlockNumber) {
                        prevElement = el;
                        prevBlockNumber = el.dataset.debugBlockNumber;
                        break;
                    }
                }
                
                if (prevElement && prevBlockNumber) {
                    const spacing = measureSpacingBetween(prevElement, element);
                    console.log(`📏 测量间距 块${prevBlockNumber} -> 块${blockCounter}: ${spacing.toFixed(1)}px`);
                    
                    spacingMeasurements.push({
                        from: prevBlockNumber,
                        to: blockCounter,
                        spacing: spacing,
                        elements: [prevElement, element]
                    });
                    
                    // 在页面上直接显示间距信息
                    addSpacingIndicator(prevElement, element, spacing, prevBlockNumber, blockCounter);
                    
                    // 特别标记第15-16块或16-17块之间的间距
                    if ((prevBlockNumber === '15' && blockCounter === 16) ||
                        (prevBlockNumber === '16' && blockCounter === 17)) {
                        highlightSpacing(prevElement, element, spacing, `块${prevBlockNumber}-${blockCounter}`);
                    }
                } else {
                    console.log(`⚠️ 块${blockCounter} 找不到前一个有效块`);
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
            const status = measurement.spacing > 30 ? '⚠️异常大' : measurement.spacing < 10 ? '⚠️异常小' : '✓正常';
            console.log(`块${measurement.from} -> 块${measurement.to}: ${measurement.spacing.toFixed(2)}px ${status}`);
        });
        console.log(`\n总共测量了 ${spacingMeasurements.length} 个间距`);
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
        
        // 在页面顶部显示总结信息
        addSummaryInfo(spacingMeasurements, abnormalSpacings, averageSpacing);
    }
    
    // 测量两个元素之间的间距
    function measureSpacingBetween(element1, element2) {
        const rect1 = element1.getBoundingClientRect();
        const rect2 = element2.getBoundingClientRect();
        return rect2.top - rect1.bottom;
    }
    
    // 在页面上添加间距指示器
    function addSpacingIndicator(element1, element2, spacing, fromBlock, toBlock) {
        const rect1 = element1.getBoundingClientRect();
        const rect2 = element2.getBoundingClientRect();
        
        // 创建间距指示器
        const spacingDiv = document.createElement('div');
        spacingDiv.className = 'debug-spacing-indicator';
        spacingDiv.style.cssText = `
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            top: ${rect1.bottom + window.scrollY}px;
            z-index: 1001;
            background: ${spacing > 30 ? '#ef4444' : spacing < 10 ? '#f59e0b' : '#10b981'};
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: bold;
            font-family: monospace;
            pointer-events: none;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        `;
        
        // 间距信息
        let spacingText = `${fromBlock}→${toBlock}: ${spacing.toFixed(1)}px`;
        
        // 如果间距异常，添加警告
        if (spacing > 30) {
            spacingText += ' ⚠️大';
        } else if (spacing < 10) {
            spacingText += ' ⚠️小';
        } else {
            spacingText += ' ✓';
        }
        
        spacingDiv.textContent = spacingText;
        
        // 添加到页面
        document.body.appendChild(spacingDiv);
        
        // 如果间距特别大，还要添加一个填充区域来显示
        if (Math.abs(spacing) > 20) {
            const spacingArea = document.createElement('div');
            spacingArea.className = 'debug-spacing-area';
            spacingArea.style.cssText = `
                position: absolute;
                left: 0;
                right: 0;
                height: ${Math.abs(spacing)}px;
                background: ${spacing > 30 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)'};
                border: 1px dashed ${spacing > 30 ? '#ef4444' : '#f59e0b'};
                top: ${rect1.bottom + window.scrollY}px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.body.appendChild(spacingArea);
        }
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
    
    // 添加总结信息到页面顶部
    function addSummaryInfo(measurements, abnormalSpacings, averageSpacing) {
        const summary = document.createElement('div');
        summary.className = 'debug-summary-info';
        summary.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 1rem;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            font-family: monospace;
            z-index: 10001;
            max-width: 300px;
            line-height: 1.4;
        `;
        
        const abnormalCount = abnormalSpacings.length;
        const totalCount = measurements.length;
        
        summary.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 0.5rem; color: #60a5fa;">📊 间距调试总结</div>
            <div>总块数: ${totalCount + 1}</div>
            <div>测量间距: ${totalCount} 个</div>
            <div>平均间距: ${averageSpacing.toFixed(1)}px</div>
            <div style="color: ${abnormalCount > 0 ? '#f87171' : '#4ade80'};">
                异常间距: ${abnormalCount} 个 ${abnormalCount > 0 ? '⚠️' : '✓'}
            </div>
            ${abnormalCount > 0 ? `
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #fbbf24;">
                    异常块: ${abnormalSpacings.map(a => `${a.from}-${a.to}`).join(', ')}
                </div>
            ` : ''}
            <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #9ca3af;">
                颜色说明:<br>
                🟢 正常 (10-30px)<br>
                🟡 偏小 (&lt;10px)<br>
                🔴 偏大 (&gt;30px)
            </div>
        `;
        
        document.body.appendChild(summary);
    }
    
    // 停止调试
    function stopDebugging() {
        // 移除所有调试元素
        document.querySelectorAll('.debug-block-indicator').forEach(el => el.remove());
        document.querySelectorAll('.debug-class-indicator').forEach(el => el.remove());
        document.querySelectorAll('.debug-spacing-highlight').forEach(el => el.remove());
        document.querySelectorAll('.debug-spacing-indicator').forEach(el => el.remove());
        document.querySelectorAll('.debug-spacing-area').forEach(el => el.remove());
        document.querySelectorAll('.debug-summary-info').forEach(el => el.remove());
        
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