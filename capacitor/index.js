import { Network } from '../utils/network';
import { Network as CapacitorNetwork } from '@capacitor/network';

export class Capacitor {
    ready(callback) {
        //If is web browser, we want boot app immidiatelly
        if (isPlatform('mobileweb') || isPlatform('desktop')) {
            this.ready(callback);
        }

        //On device, we want boot services after app is ready
        else {
            // prettier-ignore
            document.addEventListener('deviceready', () => {
                this.ready(callback);
            }, false);
        }
    }

    ready(callback) {
        callback();

        return this;
    }

    /**
     * Initialize capacitor network
     *
     * @returns
     */
    network({ user, refresh, refreshSeconds }) {
        const network = new Network({
            user: user,
        });

        // How ofthen which method should be called
        network.refresh(refresh, refreshSeconds);

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

                network.setConnected(status.connected);
            } catch (e) {
                console.error('Network error:', e);
            }
        })();

        return this;
    }
}
