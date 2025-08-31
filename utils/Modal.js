import _ from 'lodash';
import { ref, watch, nextTick } from 'vue';

export class Modal {
    constructor() {
        this.modals = ref([]);
    }

    open(name, callback) {
        return this.modals.value.push({ name, callback });
    }

    isOpen(name) {
        return this.get(name) ? true : false;
    }

    get(name) {
        return _.find(this.modals.value, { name });
    }

    getData(name) {
        return this.get(name)?.callback;
    }

    close(name) {
        // await useWaitTillKeyboardClose();

        //Close last opaned modal if no name has been given
        name = name || this.modals.value[this.modals.value.length - 1]?.name;

        if (this.isOpen(name)) {
            _.remove(this.modals.value, { name });
        }
    }

    onChange(modal, callback) {
        watch(
            () => this.isOpen(modal),
            (state) => {
                callback(state);
            }
        );
    }

    onOpen(modal, callback) {
        this.onChange(modal, (state) => {
            state ? callback(this.getData(modal)) : null;
        });
    }

    onClose(modal, callback) {
        this.onChange(modal, (state) => {
            !state ? callback(this.getData(modal)) : null;
        });
    }

    openCloseCurrent = function () {
        useCloseModal();

        const args = arguments;

        nextTick(() => {
            useOpenModal(...args);
        });
    };
}
