import { ref, computed, reactive, shallowReactive, markRaw, watch, nextTick } from 'vue';
import { uuid, sleep, translate, toOptions } from './shared.js';

// A config value may be given as a function, so labels are translated at the time of use
const resolveValue = (value) => (typeof value === 'function' ? value() : value);

const isEntry = (target) => target !== null && typeof target === 'object' && 'id' in target && 'state' in target;

const isComponent = (target) => typeof target === 'function' || (target !== null && typeof target === 'object');

export class ModalManager {
    constructor() {
        // Every mounted modal, including the ones which are closing and still animating out
        this.entries = ref([]);

        // Opened modals only, in the order they were opened. The last one is on top.
        this.modals = computed(() => this.entries.value.filter((entry) => entry.state.visible));

        // Last closed modals, newest first
        this.closed = ref([]);

        this.components = shallowReactive({});

        this.defaultComponent = null;

        this.resolvers = new Map();

        this.config = {
            // How long close() waits after the modal is hidden. Protects against double clicks.
            closeDelay: 500,

            // How long a closed modal stays mounted for its leave animation. Defaults to closeDelay.
            unmountDelay: null,

            labels: {
                close: () => translate('Zatvoriť'),
                confirm: () => translate('Potvrdiť'),
            },

            titles: {
                success: () => translate('Informácia'),
                info: () => translate('Informácia'),
                warning: () => translate('Upozornenie'),
                danger: () => translate('Upozornenie'),
                confirm: null,
            },

            texts: {
                danger: () => translate('Nastala nečakaná chyba, skúste neskôr prosím.'),
            },

            // closing(entry) runs when a modal starts closing, unmounted(entry) once it is removed
            hooks: {},
        };
    }

    configure(config = {}) {
        const { labels, titles, texts, hooks, ...rest } = config;

        Object.assign(this.config, rest);
        Object.assign(this.config.hooks, hooks || {});
        Object.assign(this.config.labels, labels || {});
        Object.assign(this.config.titles, titles || {});
        Object.assign(this.config.texts, texts || {});

        return this;
    }

    /*
     * Register components opened by name. Accepts a name and a component, or an object of them.
     * Registered modals are mounted by <ModalRenderer />, the others are expected to be
     * placed in the application template and bound to Modal.isOpen(name).
     */
    register(name, component) {
        const components = typeof name === 'object' ? name : { [name]: component };

        for (const key in components) {
            this.components[key] = markRaw(components[key]);
        }

        return this;
    }

    // Component rendering Modal.success/danger/warning/info/confirm, and wrapping components without a modal prop
    setDefaultComponent(component) {
        this.defaultComponent = component ? markRaw(component) : null;

        return this;
    }

    resolveComponent(entry) {
        if (entry.component) {
            return entry.component;
        }

        if (entry.name && this.components[entry.name]) {
            return this.components[entry.name];
        }

        return entry.message ? this.defaultComponent : null;
    }

    /*
     * Modal.open('name', data, options) opens a modal by name.
     * Modal.open(Component, props, options) opens a component through <ModalRenderer />.
     */
    open(target, payload, options = {}) {
        if (typeof target === 'string') {
            return this.create({ name: target, data: payload, ...this.splitOptions(options) });
        }

        if (!isComponent(target)) {
            throw new Error('Modal.open() expects a modal name or a component. Use Modal.success/danger/warning/info/confirm for messages.');
        }

        return this.create({ component: target, props: payload, ...this.splitOptions(options, true) });
    }

    /*
     * Options of Modal.open() may carry the header of the modal (type, title, text/message)
     * and its actions (actions, or success/cancel callbacks building the default buttons).
     */
    splitOptions(options = {}, withActions = false) {
        const { type, title, text, message, success, cancel, actions, confirmText, cancelText, ...rest } = options || {};

        const hasMessage = [type, title, text, message].some((value) => value !== undefined);

        return {
            message: hasMessage ? { type: this.normalizeType(type || 'primary'), title: title ?? null, text: text ?? message ?? null } : null,
            actions: actions ?? (withActions || success || cancel ? this.buildActions({ type, success, cancel, confirmText, cancelText }) : []),
            options: rest,
        };
    }

    normalizeType(type) {
        return type === 'error' ? 'danger' : type;
    }

    show(...args) {
        return this.open(...args);
    }

    success(input, options) {
        return this.message('success', input, options);
    }

    info(input, options) {
        return this.message('info', input, options);
    }

    warning(input, options) {
        return this.message('warning', input, options);
    }

    danger(input, options) {
        return this.message('danger', input, options, { text: resolveValue(this.config.texts.danger) });
    }

    error(input, options) {
        return this.danger(input, options);
    }

    // Resolves true when the success action closed the modal, false otherwise
    async confirm(input, options) {
        const entry = this.message('primary', input, options, {}, true);

        const { action } = await entry.result;

        return action === 'success';
    }

    /*
     * Open a message. The second argument are the options of the opening itself,
     * eg. { replace: true } closes the modal below it, as an action sheet does
     * when it hands over to a confirmation.
     */
    message(type, input, options = {}, defaults = {}, confirm = false) {
        // message is an alias of text, it has to win over the default text too
        const { message, ...given } = toOptions(input);

        if (given.text === undefined && message !== undefined) {
            given.text = message;
        }

        const { title, text, success, cancel, actions, confirmText, cancelText, ...rest } = { ...defaults, ...given };

        type = this.normalizeType(rest.type || type);

        delete rest.type;

        return this.create({
            message: {
                type,
                title: title === undefined ? resolveValue(this.config.titles[confirm ? 'confirm' : type]) : title,
                text: text ?? null,
            },
            actions: actions ?? this.buildActions({ type, success, cancel, confirmText, cancelText }, confirm),
            options: { ...rest, ...(options || {}) },
        });
    }

    buildActions({ type, success, cancel, confirmText, cancelText }, confirm = false) {
        const actions = [];

        if (confirm || cancel || !success || type === 'success') {
            actions.push({
                type: 'cancel',
                name: cancelText || resolveValue(this.config.labels.close),
                class: 'btn-secondary',
                callback: typeof cancel === 'function' ? cancel : null,
                close: true,
            });
        }

        if (confirm || success) {
            actions.push({
                type: 'success',
                name: confirmText || resolveValue(this.config.labels.confirm),
                class: 'btn-primary',
                callback: typeof success === 'function' ? success : success?.callback || null,
                enter: true,
                disabled: success?.disabled || false,
            });
        }

        return actions;
    }

    create({ name = null, component = null, props = {}, data, message = null, actions = [], options = {} }) {
        const { replace, replaceAll, ...rest } = options || {};

        options = rest;

        //A modal opened with a component is known by the name that component declares, so it
        //can be found, closed and remembered without the opening having to name it again
        name = name ?? this.componentName(component);

        // Opened in place of the modal below it, or of every opened modal
        if (replaceAll) {
            this.closeAll();
        } else if (replace) {
            this.close();
        }

        if (options?.toast) {
            console.error('Modal does not open toasts, use Toast.open(), Toast.success(), Toast.error() or Toast.warning() instead.');
        }

        let resolve;

        const result = new Promise((r) => (resolve = r));

        const entry = reactive({
            id: uuid(),
            name,
            component: component ? markRaw(component) : null,
            props: props || {},
            data,
            message,
            actions: actions || [],
            options: { ...(options || {}) },
            state: {
                visible: true,
                openedAt: Date.now(),
                closedAt: null,
            },
            result,
        });

        entry.close = (value, action) => this.close(entry, value, action);

        this.resolvers.set(entry.id, resolve);

        this.entries.value.push(entry);

        return entry;
    }

    /*
     * Find a modal by entry, id or name. A name returns the last opened modal with that name.
     * Called without any argument, the last opened modal is returned. A target given as
     * null or undefined finds nothing — a component may bind a modal it has no name for.
     */
    get(target, fromClosed = false) {
        if (isEntry(target)) {
            return target;
        }

        const list = fromClosed ? this.closed.value : [...this.modals.value].reverse();

        if (arguments.length === 0) {
            return list[0];
        }

        if (target === undefined || target === null) {
            return undefined;
        }

        return list.find((entry) => entry.id === target) || list.find((entry) => entry.name === target);
    }

    // name of <script setup> components lands in __name, an options component names itself in name
    componentName(component) {
        return component?.name || component?.__name || null;
    }

    // The last opened modal, or nothing when none is open
    top() {
        return [...this.modals.value].reverse()[0];
    }

    getData(target, fromClosed = false) {
        return this.get(target, fromClosed)?.data;
    }

    isOpen(target) {
        if (isEntry(target)) {
            return target.state.visible;
        }

        return (arguments.length === 0 ? this.top() : this.get(target)) ? true : false;
    }

    // Top modal only, used for keyboard handling
    isActive(target) {
        const entry = arguments.length === 0 ? this.top() : this.get(target);

        return entry ? this.modals.value[this.modals.value.length - 1] === entry : false;
    }

    // Ref refreshed each time the modal opens
    data(name, defaultValue = null) {
        let data = ref(this.getData(name) || defaultValue);

        this.onOpen(name, () => {
            data.value = this.getData(name);
        });

        return data;
    }

    /*
     * Run an action of the modal (its object or its type). Returning false from
     * the action callback keeps the modal opened.
     */
    async runAction(target, action) {
        const entry = target === undefined || target === null ? this.top() : this.get(target);

        if (!entry || !entry.state.visible) {
            return false;
        }

        if (typeof action === 'string') {
            action = entry.actions.find((a) => a.type === action) || { type: action };
        }

        let value;

        if (action && typeof action.callback === 'function') {
            try {
                value = await action.callback(entry);

                if (value === false) {
                    return false;
                }
            } catch (e) {
                console.error(e);
            }
        }

        await this.close(entry, value, action?.type || 'close');

        return true;
    }

    /*
     * Close a modal by entry, id or name. A name closes the last opened modal with that name.
     * Without a target, the last opened modal is closed.
     * The result promise of the modal resolves with { action, value }.
     */
    async close(target, value, action = 'close') {
        const entry = isEntry(target) ? target : target === undefined || target === null ? this.top() : this.get(target);

        if (entry && entry.state.visible) {
            entry.state.visible = false;
            entry.state.closedAt = Date.now();

            this.closed.value = [entry, ...this.closed.value].slice(0, 5);

            const resolve = this.resolvers.get(entry.id);

            this.resolvers.delete(entry.id);

            resolve?.({ action, value });

            this.config.hooks.closing?.(entry);

            setTimeout(() => this.unmount(entry), this.config.unmountDelay ?? this.config.closeDelay);
        }

        // Wait till the modal is really closed. When a loading action finishes and closes
        // the modal, the same element could be clicked again before it disappears.
        await sleep(this.config.closeDelay);
    }

    unmount(entry) {
        const index = this.entries.value.indexOf(entry);

        if (index > -1 && !entry.state.visible) {
            this.entries.value.splice(index, 1);

            this.config.hooks.unmounted?.(entry);
        }
    }

    closeAll() {
        return Promise.all([...this.modals.value].map((entry) => this.close(entry)));
    }

    /*
     * Close the last opened modal and open another one in its place. Accepts the
     * arguments of open(), or a callback opening the modal itself (eg. a preset).
     */
    async replace(...args) {
        this.close();

        await nextTick();

        return typeof args[0] === 'function' && args.length === 1 ? args[0]() : this.open(...args);
    }

    // Close every opened modal and open another one in their place
    async replaceAll(...args) {
        this.closeAll();

        await nextTick();

        return this.open(...args);
    }

    onChange(target, callback) {
        return watch(
            () => this.isOpen(target),
            (state) => {
                callback(state);
            }
        );
    }

    /*
     * A modal given by its entry is already opened when its component mounts, so the callback
     * runs right away. On the next tick, the setup of that component has to finish first,
     * otherwise the callback could reach what the component declares below it.
     */
    onOpen(target, callback) {
        if (isEntry(target) && target.state.visible) {
            nextTick(() => callback(target.data));
        }

        return this.onChange(target, (state) => {
            state ? callback(this.getData(target)) : null;
        });
    }

    onClose(target, callback) {
        return this.onChange(target, (state) => {
            !state ? callback(this.getData(target, true)) : null;
        });
    }
}

export const Modal = new ModalManager();
