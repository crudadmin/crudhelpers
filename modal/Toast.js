import { ref, computed, reactive, markRaw } from 'vue';
import { uuid, sleep, translate } from './shared.js';

// Legacy css classes of toast types, kept for the Ionic toast styles
const cssClasses = {
    success: '--success',
    warning: '--warning',
    danger: '--error',
};

const normalize = (options = {}) => {
    options = typeof options === 'object' && options !== null ? { ...options } : { message: options };

    if (options.message === undefined && options.text !== undefined) {
        options.message = options.text;
    }

    return options;
};

export class ToastManager {
    constructor() {
        // Toasts of the built-in stack, used when no opener has been set
        this.entries = ref([]);

        this.toasts = computed(() => this.entries.value.filter((entry) => entry.state.visible));

        this.component = null;

        this.opener = null;

        this.isOpened = null;

        this.connectionResolver = null;

        this.config = {
            duration: 4000,
            unmountDelay: 250,
        };
    }

    configure(config = {}) {
        Object.assign(this.config, config);

        return this;
    }

    /*
     * Custom opener, eg. the Ionic toastController. When it is set, toasts are handed over
     * to it instead of the built-in stack rendered by <ToastRenderer />.
     */
    setOpener(opener, isOpened) {
        this.opener = opener;

        this.isOpened = isOpened;

        return this;
    }

    // Component rendering one toast of the built-in stack. It receives the toast entry in the toast prop.
    setComponent(component) {
        this.component = component ? markRaw(component) : null;

        return this;
    }

    // Tells connectionError() whether the device is online
    setConnectionResolver(resolver) {
        this.connectionResolver = resolver;

        return this;
    }

    isEnabled() {
        return this.opener || this.component ? true : false;
    }

    show(options) {
        return this.open(options);
    }

    open(options) {
        options = normalize(options);

        options.type = options.type || 'info';

        if (typeof this.opener === 'function') {
            return this.opener(options);
        }

        if (!this.component) {
            console.error('No toast opener or component has been set.');
        }

        return this.push(options);
    }

    push(options) {
        const { type, title, message, duration, click, ...rest } = options;

        const entry = reactive({
            id: uuid(),
            type,
            title: title || null,
            message: message ?? null,
            duration: duration ?? this.config.duration,
            click: click || null,
            options: rest,
            state: {
                visible: true,
                openedAt: Date.now(),
            },
        });

        this.entries.value.push(entry);

        // Duration 0 or false keeps the toast opened until it is closed
        if (entry.duration) {
            setTimeout(() => this.close(entry), entry.duration);
        }

        return entry;
    }

    close(entry) {
        if (!entry || !entry.state.visible) {
            return;
        }

        entry.state.visible = false;

        setTimeout(() => {
            const index = this.entries.value.indexOf(entry);

            if (index > -1) {
                this.entries.value.splice(index, 1);
            }
        }, this.config.unmountDelay);
    }

    typed(type, options) {
        return this.open({ ...normalize(options), type, cssClass: cssClasses[type] });
    }

    success(options = {}) {
        return this.typed('success', options);
    }

    info(options = {}) {
        return this.typed('info', options);
    }

    warning(options = {}) {
        return this.typed('warning', options);
    }

    danger(options = {}) {
        return this.typed('danger', options);
    }

    error(options = {}) {
        return this.danger(options);
    }

    unknown(message) {
        return this.error({
            message: message || translate('Ospravedlňujeme sa, no nastala nečakaná chyba. Skúste neskôr prosím.'),
        });
    }

    connectionError(message) {
        if (!this.isEnabled()) {
            return;
        }

        if (typeof this.connectionResolver !== 'function' || this.connectionResolver() !== false) {
            return;
        }

        message =
            typeof message == 'string'
                ? message
                : translate('Vaše internetové pripojenie nie je zapnuté. Pre pokračovanie prosím zapnite internet.');

        this.error({ message });

        throw 'Connection for this action is required.';
    }

    async waitTillClosed() {
        const isOpened = typeof this.isOpened === 'function' ? this.isOpened : () => this.toasts.value.length > 0;

        while (isOpened()) {
            await sleep(100);
        }
    }
}

export const Toast = new ToastManager();
