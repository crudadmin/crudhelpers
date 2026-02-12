export const installEditor = async () => {
    const storageKey = 'ca_admin_token';

    const token = getQueryParam('admin_token');
    if (token) {
        // Save to localStorage
        try {
            localStorage.setItem(storageKey, token);
        } catch (e) {}

        // Boot editor with new token
        bootEditor(token, true);

        // Redirect to root, stripping away the query params
        window.location.href =
            window.location.origin + window.location.pathname;
    } else {
        // Try to get token from localStorage
        const storedToken = (() => {
            try {
                return localStorage.getItem(storageKey);
            } catch (e) {
                return null;
            }
        })();

        if (storedToken) {
            bootEditor(storedToken);
        }
    }
};

const bootEditor = async (token, active = false) => {
    // Turn on editor
    if (active == true) {
        localStorage.setItem('ca_editor_state', active);
    }

    const data = await loadConfiguration();

    window.CAEditorConfig.token = token;

    data.styles.forEach((styleUrl) => injectLink(styleUrl));

    data.scripts.forEach((scriptUrl) => injectScript(scriptUrl));
};

const loadConfiguration = async () => {
    let response = await useAxios().get(
            '/admin/api/frontend-editor/initialize'
        ),
        data = response.data;

    window.CAEditorConfig = data.config;

    return data;
};

const injectScript = (scriptUrl) => {
    const scriptElem = document.createElement('script');
    scriptElem.src = scriptUrl;
    scriptElem.async = false;
    document.head.appendChild(scriptElem);
};

const injectLink = (styleUrl) => {
    const linkElem = document.createElement('link');
    linkElem.rel = 'stylesheet';
    linkElem.href = styleUrl;
    document.head.appendChild(linkElem);
};

// Helper to get query params
const getQueryParam = (param) => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
};
