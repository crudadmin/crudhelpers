import { Network } from '../utils/Network';
import { Network as CapacitorNetwork } from '@capacitor/network';
import { isPlatform } from '@ionic/vue';

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
        if (isPlatform('mobileweb') || isPlatform('desktop')) {
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
                        network.setConnected(status.connected, true);
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
}
