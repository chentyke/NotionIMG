// Core functionality for Notion page rendering
// Global variables and initialization

// Tracking variables
let totalBlocks = 0;
let loadedBlocks = 0;
let parentPageId = null;  // Store parent page ID

// 阻止默认的左右滑动行为
document.body.style.overflowX = 'hidden';
document.documentElement.style.overflowX = 'hidden';

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

// Export variables and functions
export {
    totalBlocks,
    loadedBlocks,
    parentPageId
}; 