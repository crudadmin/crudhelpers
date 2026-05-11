import _ from 'lodash';
import { ref, watch, nextTick } from 'vue';

export const Modal = new (class Modal {
    constructor() {
        this.modals = ref([]);

        this.closed = ref([]);
    }

    show(name, callback) {
        return this.open(name, callback);
    }

    open(name, callback) {
        return this.modals.value.push({ name, callback });
    }

    isOpen(name) {
        return this.get(name) ? true : false;
    }

    get(name, missing = false) {
        const modals = missing ? this.closed.value : this.modals.value;

        return _.find(modals, { name });
    }

    data(name, defaultValue = null) {
        let data = ref(this.getData(name) || defaultValue);

        this.onOpen(name, (modal) => {
            data.value = this.getData(name);
        });

        return data;
    }

    getData(name, missing = false) {
        return this.get(name, missing)?.callback;
    }

    close(name) {
        // await useWaitTillKeyboardClose();

        //Close last opaned modal if no name has been given
        name = name || this.modals.value[this.modals.value.length - 1]?.name;

        if (this.isOpen(name)) {
            let closed = _.remove(this.modals.value, { name });

            // Keep currently closed modal at beggining of the array
            this.closed.value = [...closed, ...this.closed.value].slice(0, 5);
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
            !state ? callback(this.getData(modal, true)) : null;
        });
    }

    replace = function () {
        this.close();

        const args = arguments;

        nextTick(() => {
            this.open(...args);
        });
    };
})();
