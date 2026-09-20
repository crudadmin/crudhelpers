import { defineComponent, h, Fragment } from 'vue';
import { Modal } from './Modal.js';
import { Toast } from './Toast.js';

// A component declaring the modal prop renders the whole modal itself
const acceptsModalProp = (component) => {
    const props = component?.props;

    if (Array.isArray(props)) {
        return props.includes('modal');
    }

    return props !== null && typeof props === 'object' ? 'modal' in props : false;
};

/*
 * Mounts every modal opened with a component, a registered name or a message preset.
 * Modals opened by a name which has not been registered are left to the application template.
 */
export const ModalRenderer = defineComponent({
    name: 'ModalRenderer',

    setup() {
        const renderEntry = (entry) => {
            const component = Modal.resolveComponent(entry);

            if (!component) {
                return null;
            }

            const wrapper = Modal.defaultComponent;

            if (!wrapper || component === wrapper || acceptsModalProp(component)) {
                return h(component, { ...entry.props, key: entry.id, modal: entry });
            }

            return h(wrapper, { key: entry.id, modal: entry }, { default: () => h(component, { ...entry.props, modal: entry }) });
        };

        return () => h(Fragment, Modal.entries.value.map(renderEntry));
    },
});

// Mounts toasts of the built-in stack with the component given to Toast.setComponent()
export const ToastRenderer = defineComponent({
    name: 'ToastRenderer',

    setup() {
        return () => {
            if (!Toast.component) {
                return null;
            }

            return h(
                Fragment,
                Toast.entries.value.map((entry) => h(Toast.component, { key: entry.id, toast: entry }))
            );
        };
    },
});
