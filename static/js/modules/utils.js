// Utility functions for Notion Page Renderer

// Color mapping for Notion colors to CSS styles (same as in notionRenderer.js)
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
 * Processes rich text array from Notion API
 * @param {Array} richTextArray - Array of rich text objects
 * @returns {string} - HTML string with formatted text
 */
function processRichText(richTextArray) {
    if (!richTextArray || richTextArray.length === 0) return '';

    return richTextArray.map(textObj => {
        const text = textObj.text || {};
        const annotations = textObj.annotations || {};
        
        let content = text.content || '';
        let link = text.link || null;
        
        // HTML escape the content
        content = content
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        
        // Apply annotations
        if (annotations.bold) content = `<strong>${content}</strong>`;
        if (annotations.italic) content = `<em>${content}</em>`;
        if (annotations.strikethrough) content = `<del>${content}</del>`;
        if (annotations.underline) content = `<u>${content}</u>`;
        if (annotations.code) content = `<code>${content}</code>`;
        
        // Apply color using inline styles
        if (annotations.color && annotations.color !== 'default') {
            const colorStyle = getNotionColorStyle(annotations.color);
            if (colorStyle) {
                content = `<span style="${colorStyle}">${content}</span>`;
            }
        }
        
        // Apply link if present
        if (link) {
            content = `<a href="${link.url}" target="_blank" rel="noopener noreferrer">${content}</a>`;
        }
        
        return content;
    }).join('');
}

/**
 * Generates a readable ID for headings
 * @param {string} text - The heading text
 * @returns {string} - A URL-friendly ID
 */
function generateHeadingId(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')  // Remove non-word chars
        .replace(/[\s_-]+/g, '-')  // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Copies text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        
        // Fallback method
        try {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = 0;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return true;
        } catch (fallbackErr) {
            console.error('Fallback copy failed: ', fallbackErr);
            return false;
        }
    }
}

/**
 * Updates page title and meta tags
 * @param {string} title - The page title
 */
function updatePageTitle(title) {
    document.title = title || 'Notion Page';
    
    // Update meta tags if present
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription && title) {
        metaDescription.setAttribute('content', `${title} - Notion Page`);
    }
}

/**
 * Shows a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (success, error, info)
 * @param {number} duration - Duration in ms
 */
function showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toastContainer.removeChild(toast);
            }
            
            // Remove container if empty
            if (toastContainer.children.length === 0) {
                document.body.removeChild(toastContainer);
            }
        }, 300);
    }, duration);
}

// Export functions
export {
    processRichText,
    generateHeadingId,
    copyToClipboard,
    updatePageTitle,
    showToast
}; 