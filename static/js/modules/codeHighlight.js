// Code syntax highlighting module
export class CodeHighlighter {
    constructor() {
        this.isHighlightJSLoaded = false;
        this.pendingBlocks = [];
        this.init();
    }

    async init() {
        // Check if highlight.js is available
        if (typeof hljs !== 'undefined') {
            this.isHighlightJSLoaded = true;
            this.configurehighlight();
            this.processPendingBlocks();
        } else {
            // Wait for highlight.js to load
            const checkInterval = setInterval(() => {
                if (typeof hljs !== 'undefined') {
                    this.isHighlightJSLoaded = true;
                    this.configurehighlight();
                    this.processPendingBlocks();
                    clearInterval(checkInterval);
                }
            }, 100);

            // Stop checking after 5 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                if (!this.isHighlightJSLoaded) {
                    console.warn('highlight.js failed to load within 5 seconds');
                }
            }, 5000);
        }
    }

    configurehighlight() {
        if (typeof hljs !== 'undefined') {
            // Configure highlight.js
            hljs.configure({
                ignoreUnescapedHTML: true,
                throwUnescapedHTML: false,
                languages: [
                    'javascript', 'python', 'java', 'cpp', 'c', 'csharp', 
                    'php', 'go', 'rust', 'swift', 'html', 'css', 'scss',
                    'json', 'xml', 'yaml', 'markdown', 'bash', 'sql',
                    'typescript', 'plaintext'
                ]
            });
        }
    }

    highlightElement(element) {
        if (this.isHighlightJSLoaded && typeof hljs !== 'undefined') {
            try {
                hljs.highlightElement(element);
                element.classList.add('hljs-highlighted');
                return true;
            } catch (error) {
                console.warn('Failed to highlight code element:', error);
                return false;
            }
        } else {
            // Add to pending blocks to highlight later
            this.pendingBlocks.push(element);
            return false;
        }
    }

    highlightAllCodeBlocks() {
        const codeBlocks = document.querySelectorAll('.code-block code:not(.hljs-highlighted)');
        let highlightedCount = 0;

        codeBlocks.forEach(block => {
            if (this.highlightElement(block)) {
                highlightedCount++;
            }
        });

        console.log(`Highlighted ${highlightedCount} code blocks`);
        return highlightedCount;
    }

    processPendingBlocks() {
        if (this.isHighlightJSLoaded && this.pendingBlocks.length > 0) {
            console.log(`Processing ${this.pendingBlocks.length} pending code blocks`);
            const processedBlocks = [...this.pendingBlocks];
            this.pendingBlocks = [];

            processedBlocks.forEach(block => {
                this.highlightElement(block);
            });
        }
    }

    // Language mapping for better compatibility
    static getLanguageClass(notionLanguage) {
        const languageMap = {
            'plain text': 'plaintext',
            'plain': 'plaintext',
            'text': 'plaintext',
            'javascript': 'javascript',
            'js': 'javascript',
            'typescript': 'typescript',
            'ts': 'typescript',
            'python': 'python',
            'py': 'python',
            'java': 'java',
            'c++': 'cpp',
            'cpp': 'cpp',
            'c': 'c',
            'csharp': 'csharp',
            'c#': 'csharp',
            'php': 'php',
            'go': 'go',
            'rust': 'rust',
            'swift': 'swift',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'markdown': 'markdown',
            'md': 'markdown',
            'bash': 'bash',
            'shell': 'bash',
            'sh': 'bash',
            'zsh': 'bash',
            'fish': 'bash',
            'powershell': 'powershell',
            'cmd': 'batch',
            'batch': 'batch',
            'sql': 'sql',
            'mysql': 'sql',
            'postgresql': 'sql',
            'sqlite': 'sql',
            'mongodb': 'javascript',
            'dockerfile': 'dockerfile',
            'docker': 'dockerfile',
            'nginx': 'nginx',
            'apache': 'apache',
            'vim': 'vim',
            'makefile': 'makefile',
            'cmake': 'cmake',
            'gradle': 'gradle',
            'maven': 'xml'
        };

        return languageMap[notionLanguage?.toLowerCase()] || notionLanguage?.toLowerCase() || 'plaintext';
    }

    // Enhanced copy functionality for code blocks
    static enhanceCopyCode() {
        // This will be used to enhance the existing copyCode function
        return function(button) {
            const codeId = button.getAttribute('data-code-id');
            const codeElement = document.getElementById(codeId);
            if (!codeElement) return;

            // Get the raw text content, avoiding any syntax highlighting artifacts
            let text = codeElement.textContent || codeElement.innerText;
            
            // Clean up any extra whitespace or artifacts from syntax highlighting
            text = text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

            // Use Clipboard API
            navigator.clipboard.writeText(text).then(() => {
                // Show success state on button
                const originalHTML = button.innerHTML;
                button.innerHTML = `
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    Copied!
                `;
                button.classList.add('copied');

                // Reset after 2 seconds
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.classList.remove('copied');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code: ', err);
                
                // Fallback for older browsers
                try {
                    const textArea = document.createElement('textarea');
                    textArea.value = text;
                    textArea.style.position = 'fixed';
                    textArea.style.left = '-999999px';
                    textArea.style.top = '-999999px';
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    document.execCommand('copy');
                    textArea.remove();
                    
                    // Show success message
                    button.textContent = 'Copied!';
                    setTimeout(() => {
                        button.innerHTML = originalHTML;
                    }, 2000);
                } catch (fallbackError) {
                    console.error('Fallback copy failed:', fallbackError);
                }
            });
        };
    }
}

// Create global instance
export const codeHighlighter = new CodeHighlighter(); 