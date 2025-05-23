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

// Setter functions
function setTotalBlocks(count) {
    totalBlocks = count;
}

function setLoadedBlocks(count) {
    loadedBlocks = count;
}

function incrementLoadedBlocks() {
    loadedBlocks++;
}

function setParentPageId(id) {
    parentPageId = id;
}

// Getter functions
function getTotalBlocks() {
    return totalBlocks;
}

function getLoadedBlocks() {
    return loadedBlocks;
}

function getParentPageId() {
    return parentPageId;
}

// Export variables and functions
export {
    getTotalBlocks,
    getLoadedBlocks,
    getParentPageId,
    setTotalBlocks,
    setLoadedBlocks,
    incrementLoadedBlocks,
    setParentPageId
}; 