import _ from 'lodash';

export class Toast {
    constructor({ opener }) {
        this.opener = opener;

        return this;
    }

    open(options) {
        const opener = this.opener;

        // Identifiy ionic toast opener
        if (isIonicToastOpener(opener)) {
            openIonicToast(opener, options);
        }

        // Custom opener
        else if (typeof opener === 'function') {
            opener(options);
        } else {
            console.error('Invalid opener', opener);
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
}

const isIonicToastOpener = (opener) => {
    return (
        typeof opener === 'object' && 'create' in opener && 'dismiss' in opener
    );
};

const openIonicToast = async (opener, options) => {
    Mobile.waitTillKeyboardClose();

    options = typeof options == 'object' ? options : { message: options };

    let { message, duration, cssClass } = options;

    duration = duration || 2500;

    const toast = await opener.create({
        message,
        duration,
        cssClass,
        swipeGesture: 'vertical',
    });

    toast.present();

    if (toast.shadowRoot) {
        toast.shadowRoot.addEventListener('click', () => {
            if (options.click) {
                options.click();
            }

            if (toast) {
                toast.dismiss();
            }
        });
    }
};
