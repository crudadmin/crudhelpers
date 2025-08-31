import _ from 'lodash';
import { ref, watch, nextTick } from 'vue';

export class Toast {
    constructor({ opener }) {
        this.opener = opener;

        return this;
    }

    open(options) {
        this.opener(options);
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
}
