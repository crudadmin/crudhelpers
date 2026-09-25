import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick, ref, defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { ModalManager, Modal } from '../modal/Modal.js';
import { Toast } from '../modal/Toast.js';

/*
 * Every test gets its own manager, the exported singleton would carry entries,
 * hooks and registered components from one test into another.
 */
let modal;

beforeEach(() => {
    modal = new ModalManager().configure({ closeDelay: 0, unmountDelay: 0 });
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('opening and closing', () => {
    it('opens the same name twice as two entries and closes the last one by the name', async () => {
        const first = modal.open('confirm-delete', { id: 1 });
        const second = modal.open('confirm-delete', { id: 2 });

        expect(modal.modals.value).toHaveLength(2);
        expect(first.id).not.toBe(second.id);
        expect(modal.get('confirm-delete')).toBe(second);

        await modal.close('confirm-delete');

        expect(second.state.visible).toBe(false);
        expect(first.state.visible).toBe(true);
        expect(modal.getData('confirm-delete')).toEqual({ id: 1 });
    });

    it('resolves the result with the action and the value of the closing', async () => {
        const entry = modal.open('picker');

        await modal.close(entry, 'picked value', 'success');

        await expect(entry.result).resolves.toEqual({ action: 'success', value: 'picked value' });
    });

    it('resolves confirm() true only when the success action closed it', async () => {
        const accepted = modal.confirm('Delete?');

        await modal.runAction(modal.top(), 'success');

        await expect(accepted).resolves.toBe(true);

        const declined = modal.confirm('Delete?');

        await modal.runAction(modal.top(), 'cancel');

        await expect(declined).resolves.toBe(false);

        const closed = modal.confirm('Delete?');

        await modal.close();

        await expect(closed).resolves.toBe(false);
    });

    it('keeps the modal open when an action returns false', async () => {
        const entry = modal.info({ text: 'Save?', success: () => false });

        await expect(modal.runAction(entry, 'success')).resolves.toBe(false);

        expect(entry.state.visible).toBe(true);

        const custom = modal.open('custom', null, {
            actions: [{ type: 'keep', callback: () => false }],
        });

        await modal.runAction(custom, custom.actions[0]);

        expect(custom.state.visible).toBe(true);
    });

    it('closes the modal with the value an action returns', async () => {
        const entry = modal.info({ success: () => 'saved' });

        await modal.runAction(entry, 'success');

        expect(entry.state.visible).toBe(false);
        await expect(entry.result).resolves.toEqual({ action: 'success', value: 'saved' });
    });

    it('closes every modal with closeAll()', async () => {
        modal.open('a');
        modal.open('b');
        modal.success('Done');

        await modal.closeAll();

        expect(modal.modals.value).toHaveLength(0);
        expect(modal.isOpen()).toBe(false);
    });

    it('unmounts closed entries after unmountDelay and fires the closing and unmounted hooks', async () => {
        vi.useFakeTimers();

        const closing = vi.fn();
        const unmounted = vi.fn();

        modal.configure({ closeDelay: 0, unmountDelay: 300, hooks: { closing, unmounted } });

        const entry = modal.open('a');

        modal.close(entry);

        expect(closing).toHaveBeenCalledWith(entry);
        expect(unmounted).not.toHaveBeenCalled();
        expect(modal.entries.value).toContain(entry);

        vi.advanceTimersByTime(299);

        expect(modal.entries.value).toContain(entry);

        vi.advanceTimersByTime(1);

        expect(modal.entries.value).not.toContain(entry);
        expect(unmounted).toHaveBeenCalledWith(entry);
    });

    it('falls back to closeDelay when no unmountDelay is configured', () => {
        vi.useFakeTimers();

        modal.configure({ closeDelay: 200, unmountDelay: null });

        const entry = modal.open('a');

        modal.close(entry);

        vi.advanceTimersByTime(199);

        expect(modal.entries.value).toContain(entry);

        vi.advanceTimersByTime(1);

        expect(modal.entries.value).not.toContain(entry);
    });

    it('lists only the visible entries in Modal.modals', () => {
        vi.useFakeTimers();

        modal.configure({ unmountDelay: 1000 });

        const closed = modal.open('a');

        modal.open('b');
        modal.close(closed);

        //The closed entry stays mounted for its leave animation
        expect(modal.entries.value).toHaveLength(2);

        //Legacy checks of Modal.modals.length count the opened ones only
        expect(modal.modals.value).toHaveLength(1);
        expect(modal.modals.value[0].name).toBe('b');
    });
});

describe('messages', () => {
    it('lets the message alias win over the default danger text', () => {
        expect(modal.danger().message.text).toBe('Nastala nečakaná chyba, skúste neskôr prosím.');
        expect(modal.danger({ message: 'Server is down' }).message.text).toBe('Server is down');
        expect(modal.danger('Plain text').message.text).toBe('Plain text');

        //An explicit text wins over the alias
        expect(modal.danger({ text: 'Text', message: 'Alias' }).message.text).toBe('Text');
    });

    it('normalizes the error type to danger', () => {
        expect(modal.error('Oops').message.type).toBe('danger');
        expect(modal.info({ type: 'error', text: 'x' }).message.type).toBe('danger');
        expect(modal.open('named', null, { type: 'error' }).message.type).toBe('danger');
    });

    it('fills the default title of the type', () => {
        expect(modal.warning('x').message.title).toBe('Upozornenie');
        expect(modal.success('x').message.title).toBe('Informácia');
        expect(modal.success({ text: 'x', title: null }).message.title).toBe(null);
    });

    it('renames the buttons of one modal only with confirmText and cancelText', () => {
        const renamed = modal.info({ text: 'x', success: () => {}, cancel: () => {}, confirmText: 'Yes', cancelText: 'No' });

        expect(renamed.actions.map((action) => action.name)).toEqual(['No', 'Yes']);

        const next = modal.info({ text: 'x', success: () => {}, cancel: () => {} });

        expect(next.actions.map((action) => action.name)).toEqual(['Zatvoriť', 'Potvrdiť']);
    });

    it('logs an error for the toast option and opens no toast', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        Toast.entries.value = [];

        const entry = modal.success({ text: 'Saved', toast: true });

        expect(error).toHaveBeenCalledWith(expect.stringContaining('Modal does not open toasts'));
        expect(Toast.entries.value).toHaveLength(0);

        //The message is still opened as a modal
        expect(entry.state.visible).toBe(true);
    });
});

describe('Modal.open(Component, props, options)', () => {
    const Component = { name: 'EditDialog', template: '<div />' };

    it('splits the header, the actions and the other options', () => {
        const success = vi.fn();

        const entry = modal.open(Component, { id: 5 }, { title: 'Edit', class: '--wide', success });

        expect(entry.component).toBe(Component);
        expect(entry.props).toEqual({ id: 5 });
        expect(entry.message).toEqual({ type: 'primary', title: 'Edit', text: null });
        expect(entry.options).toEqual({ class: '--wide' });
        expect(entry.actions.map((action) => action.type)).toEqual(['success']);
        expect(entry.actions[0].callback).toBe(success);
    });

    it('gives a component opening a close button and no header', () => {
        const entry = modal.open(Component, {});

        expect(entry.message).toBe(null);
        expect(entry.actions.map((action) => action.type)).toEqual(['cancel']);
    });

    it('gives no actions to a modal opened by name', () => {
        const entry = modal.open('named', { id: 1 }, { title: 'Title', class: '--x' });

        expect(entry.actions).toEqual([]);
        expect(entry.data).toEqual({ id: 1 });
        expect(entry.message.title).toBe('Title');
        expect(entry.options).toEqual({ class: '--x' });
    });

    it('rejects a target which is neither a name nor a component', () => {
        expect(() => modal.open(5)).toThrow(/expects a modal name or a component/);
    });

    it('takes the name of the component, falls back to __name and stays null without any', () => {
        expect(modal.open({ name: 'Named', __name: 'Setup' }).name).toBe('Named');
        expect(modal.open({ __name: 'SetupComponent' }).name).toBe('SetupComponent');
        expect(modal.open({ template: '<div />' }).name).toBe(null);

        //The modal is found by the name of its component
        expect(modal.get('SetupComponent').component.__name).toBe('SetupComponent');
    });

    it('lets a name given by the opening win over the name of the component', () => {
        const entry = modal.create({ name: 'given', component: { name: 'Declared' } });

        expect(entry.name).toBe('given');
    });
});

describe('open and close callbacks', () => {
    it('runs onOpen(entry) for an already opened entry on the next tick with its data', async () => {
        const entry = modal.open('named', { id: 7 });
        const callback = vi.fn();

        modal.onOpen(entry, callback);

        expect(callback).not.toHaveBeenCalled();

        await nextTick();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith({ id: 7 });
    });

    it('runs onOpen(name) when a modal with the name opens', async () => {
        const callback = vi.fn();

        const stop = modal.onOpen('later', callback);

        modal.open('later', { id: 3 });

        await nextTick();

        expect(callback).toHaveBeenCalledWith({ id: 3 });

        stop();
    });

    it('passes the data of the closed modal to onClose(name)', async () => {
        const callback = vi.fn();

        modal.open('closing', { id: 9 });

        const stop = modal.onClose('closing', callback);

        await modal.close('closing');
        await nextTick();

        expect(callback).toHaveBeenCalledWith({ id: 9 });

        stop();
    });

    it('lets a component declare the dependencies of its onOpen callback below the registration', async () => {
        const entry = modal.open('environment', { value: 'production' });
        const seen = [];

        //Regression: AppEnvironmentModal threw a TDZ error and rendered nothing
        const Component = defineComponent({
            props: ['modal'],
            setup(props) {
                modal.onOpen(props.modal, (data) => {
                    seen.push(label.value + ':' + data.value);
                });

                const label = ref('environment');

                return { label };
            },
            template: '<div class="environment">{{ label }}</div>',
        });

        const wrapper = mount(Component, { props: { modal: entry } });

        expect(wrapper.find('.environment').exists()).toBe(true);

        await nextTick();

        expect(seen).toEqual(['environment:production']);

        wrapper.unmount();
    });
});

describe('replace', () => {
    it('closes the top modal and returns what the callback opens', async () => {
        const below = modal.open('below');
        const top = modal.open('top');

        const result = await modal.replace(() => modal.success('Replaced'));

        expect(top.state.visible).toBe(false);
        expect(below.state.visible).toBe(true);
        expect(result.message.text).toBe('Replaced');
        expect(modal.top()).toBe(result);
    });

    it('still accepts the arguments of open()', async () => {
        const top = modal.open('top');

        const result = await modal.replace('next', { id: 2 });

        expect(top.state.visible).toBe(false);
        expect(result.name).toBe('next');
        expect(result.data).toEqual({ id: 2 });
    });

    it('replaces every opened modal with replaceAll()', async () => {
        const first = modal.open('first');
        const second = modal.open('second');

        const result = await modal.replaceAll('only');

        expect(first.state.visible).toBe(false);
        expect(second.state.visible).toBe(false);
        expect(modal.modals.value).toEqual([result]);
    });
});

describe('the exported singleton', () => {
    it('is a ModalManager', () => {
        expect(Modal).toBeInstanceOf(ModalManager);
    });
});
