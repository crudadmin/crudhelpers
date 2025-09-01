import _ from 'lodash';
import * as StoresPreset from '../store/index.js';
import { Axios } from './Axios.js';

export const useAxios = () => {
    return Axios.axios;
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

    //If clicked element is not button, try to find closest button
    if (['BUTTON'].includes(el.nodeName) == false) {
        el = el.closest('button, .icon-btn') || el;
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
    } catch (e) {
        console.error(e);
    }

    el.removeAttribute('disabled');
    el.removeAttribute('lazy-click-loading');

    el.loading = false;
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

export const AutoImportPreset = (preset) => {
    return {
        '@crudadmin/helpers': Object.keys(StoresPreset),
    };
};
