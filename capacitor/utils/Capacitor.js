import { Network } from '../../utils/Network.js';
import { Mobile } from './Mobile.js';
import { Network as CapacitorNetwork } from '@capacitor/network';
import { Keyboard } from '@capacitor/keyboard';
import { useMobileStore } from '../../store/mobileStore.js';
import { Toast } from '../../utils/Toast.js';
import { toastController } from '@ionic/vue';

export class Capacitor {
    constructor(
        options = {
            user: null,
            refresh: null,
            refreshSeconds: 600,
        }
    ) {
        this.network = null;

        this.options = options;

        return this;
    }

    ready(callback) {
        //If is web browser, we want boot app immidiatelly
        if (Mobile.isDesktop()) {
            this.initialize(callback);
        }

        //On device, we want boot services after app is ready
        else {
            // prettier-ignore
            document.addEventListener('deviceready', () => {
                this.initialize(callback);
            }, false);
        }
    }

    initialize(callback) {
        callback();

        this.initializeNetwork({
            user: this.options.user,
            refresh: this.options.refresh,
            refreshSeconds: this.options.refreshSeconds,
        });

        this.initializeKeyboard();

        this.setToastOpener();

        return this;
    }

    /**
     * Initialize capacitor network
     *
     * @returns
     */
    initializeNetwork({ user, refresh, refreshSeconds }) {
        this.network = new Network({
            user: user,
        });

        // How ofthen which method should be called
        this.network.refresh(refresh, refreshSeconds);

        // Listen for capacitor network status change
        (async () => {
            try {
                //We need reset all listeners on initializing
                CapacitorNetwork.removeAllListeners();

                CapacitorNetwork.addListener(
                    'networkStatusChange',
                    (status) => {
                        this.network.setConnected(status.connected, true);
                    }
                );

                //Update actual network status
                let status = await CapacitorNetwork.getStatus();

                this.network.setConnected(status.connected);
            } catch (e) {
                console.error('Network error:', e);
            }
        })();

        return this;
    }

    initializeKeyboard() {
        const mobileStore = useMobileStore();

        mobileStore.keyboard = false;

        if (Mobile.isDesktop()) {
            return;
        }

        Keyboard.addListener('keyboardWillShow', (info) => {
            mobileStore.keyboard = true;
        });

        Keyboard.addListener('keyboardDidHide', (info) => {
            mobileStore.keyboard = false;
        });
    }

    setToastOpener() {
        Toast.setOpener(async (options) => {
            Mobile.waitTillKeyboardClose();

            options =
                typeof options == 'object' ? options : { message: options };

            let { message, duration, cssClass } = options;

            duration = duration || 2500;

            const toast = await toastController.create({
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
        });
    }
}
