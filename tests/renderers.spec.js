import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { Modal } from '../modal/Modal.js';
import { Toast } from '../modal/Toast.js';
import { ModalRenderer, ToastRenderer } from '../modal/renderers.js';

/*
 * The renderers draw the singletons, so their state is cleared around every test.
 */
const DefaultModal = {
    name: 'DefaultModal',
    props: ['modal'],
    template: '<div class="default-modal" :data-name="modal.name"><h4 v-if="modal.message">{{ modal.message.text }}</h4><slot /></div>',
};

const reset = () => {
    Modal.entries.value = [];
    Modal.closed.value = [];
    Modal.setDefaultComponent(null);

    for (const key in Modal.components) {
        delete Modal.components[key];
    }

    Toast.entries.value = [];
    Toast.setComponent(null);
};

beforeEach(reset);
afterEach(reset);

describe('ModalRenderer', () => {
    it('renders registered names, components and presets, and skips unregistered names', async () => {
        Modal.setDefaultComponent(DefaultModal);
        Modal.register('registered', { props: ['modal'], template: '<div class="registered">{{ modal.data.id }}</div>' });

        const wrapper = mount(ModalRenderer);

        Modal.open('registered', { id: 4 });
        Modal.open('unregistered');
        Modal.success('Preset text');

        await nextTick();

        expect(wrapper.find('.registered').text()).toBe('4');
        expect(wrapper.find('[data-name="unregistered"]').exists()).toBe(false);
        expect(wrapper.find('.default-modal h4').text()).toBe('Preset text');

        wrapper.unmount();
    });

    it('renders a component declaring the modal prop directly', async () => {
        Modal.setDefaultComponent(DefaultModal);

        const OwnModal = { props: ['modal', 'title'], template: '<section class="own">{{ title }}</section>' };

        const wrapper = mount(ModalRenderer);

        const entry = Modal.open(OwnModal, { title: 'Own window' });

        await nextTick();

        expect(wrapper.find('.own').text()).toBe('Own window');
        expect(wrapper.find('.default-modal').exists()).toBe(false);
        expect(wrapper.findComponent(OwnModal).props('modal')).toBe(entry);

        wrapper.unmount();
    });

    it('wraps a component without the modal prop in the default component', async () => {
        Modal.setDefaultComponent(DefaultModal);

        const Content = { props: ['label'], template: '<p class="content">{{ label }}</p>' };

        const wrapper = mount(ModalRenderer);

        const entry = Modal.open(Content, { label: 'Inside' });

        await nextTick();

        expect(wrapper.find('.default-modal .content').text()).toBe('Inside');
        expect(wrapper.findComponent(DefaultModal).props('modal')).toBe(entry);

        wrapper.unmount();
    });

    it('renders a component on its own when no default component is set', async () => {
        const Content = { props: ['label'], template: '<p class="content">{{ label }}</p>' };

        const wrapper = mount(ModalRenderer);

        Modal.open(Content, { label: 'Bare' });

        await nextTick();

        expect(wrapper.find('.content').text()).toBe('Bare');

        wrapper.unmount();
    });

    it('keeps a closed entry mounted until it unmounts', async () => {
        Modal.configure({ closeDelay: 0, unmountDelay: 0 });
        Modal.setDefaultComponent(DefaultModal);

        const wrapper = mount(ModalRenderer);

        const entry = Modal.success('Bye');

        await nextTick();

        expect(wrapper.find('.default-modal').exists()).toBe(true);

        await Modal.close(entry);
        await new Promise((resolve) => setTimeout(resolve, 0));
        await nextTick();

        expect(wrapper.find('.default-modal').exists()).toBe(false);

        wrapper.unmount();
    });
});

describe('ToastRenderer', () => {
    it('renders the toasts of the built-in stack with the toast component', async () => {
        Toast.setComponent({ props: ['toast'], template: '<div class="toast-item">{{ toast.message }}</div>' });

        const wrapper = mount(ToastRenderer);

        Toast.open({ message: 'Hello', duration: 0 });

        await nextTick();

        expect(wrapper.find('.toast-item').text()).toBe('Hello');

        wrapper.unmount();
    });
});
