import { useSleep } from './helpers';
import { isPlatform } from '@ionic/vue';

export class Mobile {
    async waitTillKeyboardClose() {
        const delay = 300;

        if (useMobileStore().keyboard) {
            await useSleep(delay);
        }
    }

    isDesktop() {
        return (isPlatform('mobileweb') || isPlatform('desktop')) === true;
    }
}
