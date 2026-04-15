// VotingApp utility object for API calls and helper functions
const VotingApp = {
    // Make API calls
    api: async function(endpoint, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = { ...defaultOptions, ...options };

        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(endpoint, config);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }

            return result;
        } catch (error) {
            console.error('API call error:', error);
            throw error;
        }
    },

    // Escape HTML to prevent XSS
    escapeHtml: function(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Resolve asset URLs
    resolveAssetUrl: function(path) {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return path.startsWith('/') ? path : '/' + path;
    }
};

// Make VotingApp globally available
window.VotingApp = VotingApp;