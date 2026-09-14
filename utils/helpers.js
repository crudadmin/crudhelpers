import _ from 'lodash';
import * as StoresPreset from '../store/index.js';
import { Axios } from './Axios.js';
import { Response } from './Response.js';

export const useAxios = () => {
    return Axios.create();
};

export const useResponse = (payload, options = {}) => {
    if (payload) {
        return Response.get(payload, options);
    }

    return Response;
};

export const generateUuid = () => {
    return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
        (
            c ^
            (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16)
    );
};

export const useSleep = (delay) =>
    new Promise((resolve) => setTimeout(resolve, delay));

/**
 * Add loading progress on given element
 */
export const useLazyClick = async (e, callback) => {
    let el = e.nodeName ? e : e.target;

    // If clicked element is not button, try to find closest button
    // Because if ion-element is clicked, e.target may be different all the time.
    // prettier-ignore
    if (['BUTTON'].includes(el.nodeName) == false) {
        el = el.closest('ion-button, ion-fab-button, ion-item, ion-card-content, button, .icon-btn') || el;
    }

    if (el.loading) {
        return;
    }

    el.loading = true;

    el.setAttribute('disabled', true);
    el.setAttribute('lazy-click-loading', true);

    try {
        if (callback) {
            await callback(e);
        }
    } finally {
        el.removeAttribute('disabled');
        el.removeAttribute('lazy-click-loading');

        el.loading = false;
    }
};

export const useObjectToFormData = (obj, rootName, ignoreList) => {
    var formData = new FormData();

    function appendFormData(data, root) {
        root = root || '';

        if (data instanceof FormData) {
            for (const [key, value] of data.entries()) {
                formData.append(key, value);
            }
        } else if (data instanceof File) {
            formData.append(root, data);
        } else if (Array.isArray(data)) {
            if (data.length == 0) {
                formData.append(root, '');
            } else {
                for (var i = 0; i < data.length; i++) {
                    appendFormData(data[i], root + '[' + i + ']');
                }
            }
        } else if (typeof data === 'object' && data) {
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    if (root === '') {
                        appendFormData(data[key], key);
                    } else {
                        appendFormData(data[key], root + '[' + key + ']');
                    }
                }
            }
        } else {
            formData.append(root, _.isNil(data) ? '' : data);
        }
    }

    appendFormData(obj, rootName);

    return formData;
};

/**
 * Is version `a` newer than `b`? Compares dotted numeric versions segment by segment,
 * so 3.0.10 correctly counts as newer than 3.0.9. Non-numeric or missing input -> false.
 */
export const useIsVersionNewer = (a, b) => {
    if (!a || !b) {
        return false;
    }

    const parse = (v) =>
        String(v)
            .split('.')
            .map((n) => parseInt(n, 10) || 0);

    const left = parse(a);
    const right = parse(b);
    const length = Math.max(left.length, right.length);

    for (let i = 0; i < length; i++) {
        const diff = (left[i] || 0) - (right[i] || 0);

        if (diff !== 0) {
            return diff > 0;
        }
    }

    return false;
};

export const AutoImportPreset = (preset) => {
    return {
        '@crudadmin/helpers': Object.keys(StoresPreset),
    };
};
