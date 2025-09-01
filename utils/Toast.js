import { useNetworkStore } from '../store/networkStore.js';

import _ from 'lodash';

export const Toast = new (class Toast {
    setOpener(opener) {
        this.opener = opener;
    }

    open(options) {
        if (typeof this.opener === 'function') {
            this.opener(options);
        } else {
            console.error('Invalid opener', this.opener);
        }
    }

    error(options = {}) {
        options = typeof options == 'object' ? options : { message: options };

        this.open({ ...options, cssClass: '--error' });
    }

    success(options = {}) {
        options = typeof options == 'object' ? options : { message: options };

        this.open({ ...options, cssClass: '--success' });
    }

    unknown(message) {
        this.error({
            // prettier-ignore
            message: message||__('Ospravedlňujeme sa, no nastala nečakaná chyba. Skúste neskôr prosím.'),
        });
    }

    connectionError(message) {
        if (useNetworkStore().connected !== false) {
            return;
        }

        // prettier-ignore
        var message =
                typeof message == 'string'
                    ? message
                    : __('Vaše internetové pripojenie nie je zapnuté. Pre pokračovanie prosím zapnite internet.');

        this.error({ message });

        throw 'Connection for this action is required.';
    }
})();
