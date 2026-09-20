/*
 * Small helpers shared by Modal and Toast. They must stay free of Pinia, axios
 * and other heavy imports, because the `@crudadmin/helpers/modal` entry is
 * loaded by projects which do not use the rest of this package.
 */

export const uuid = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;

        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
};

export const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

// The global gettext helper is optional, so labels fall back to the source text
export const translate = (text) => {
    return typeof __ === 'function' ? __(text) : text;
};

// Accepts a message given as plain text or as an options object
export const toOptions = (input) => {
    if (input === null || input === undefined) {
        return {};
    }

    return typeof input === 'object' ? input : { text: input };
};
