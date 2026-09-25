import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastManager } from '../modal/Toast.js';

let toast;

beforeEach(() => {
    vi.useFakeTimers();

    toast = new ToastManager().configure({ duration: 1000, unmountDelay: 100 });

    //The built-in stack is rendered by a component, without one an error is logged
    toast.setComponent({ template: '<div />' });
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('built-in stack', () => {
    it('closes a toast after its duration and unmounts it after unmountDelay', () => {
        const entry = toast.success('Saved');

        expect(entry.type).toBe('success');
        expect(entry.message).toBe('Saved');
        expect(entry.options.cssClass).toBe('--success');
        expect(toast.toasts.value).toEqual([entry]);

        vi.advanceTimersByTime(999);

        expect(entry.state.visible).toBe(true);

        vi.advanceTimersByTime(1);

        expect(entry.state.visible).toBe(false);
        expect(toast.toasts.value).toHaveLength(0);
        expect(toast.entries.value).toContain(entry);

        vi.advanceTimersByTime(100);

        expect(toast.entries.value).not.toContain(entry);
    });

    it('keeps a toast with duration 0 opened until it is closed', () => {
        const entry = toast.open({ message: 'Stays', duration: 0 });

        vi.advanceTimersByTime(60000);

        expect(entry.state.visible).toBe(true);

        toast.close(entry);

        expect(entry.state.visible).toBe(false);
    });

    it('takes a duration of its own over the configured one', () => {
        const entry = toast.open({ message: 'Short', duration: 50 });

        vi.advanceTimersByTime(50);

        expect(entry.state.visible).toBe(false);
    });

    it('maps error to the danger type and accepts text as the message', () => {
        const entry = toast.error({ text: 'Failed' });

        expect(entry.type).toBe('danger');
        expect(entry.message).toBe('Failed');
        expect(entry.options.cssClass).toBe('--error');
    });

    it('logs an error when neither an opener nor a component is set', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        toast.setComponent(null);
        toast.open('Nowhere');

        expect(error).toHaveBeenCalledWith('No toast opener or component has been set.');
    });
});

describe('opener', () => {
    it('takes precedence over the built-in stack', () => {
        const opener = vi.fn(() => 'opened');

        toast.setOpener(opener);

        expect(toast.warning('Careful')).toBe('opened');
        expect(opener).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning', message: 'Careful', cssClass: '--warning' }));
        expect(toast.entries.value).toHaveLength(0);
    });
});

describe('connectionError()', () => {
    it('does nothing while the device is online or the state is unknown', () => {
        expect(() => toast.connectionError()).not.toThrow();

        toast.setConnectionResolver(() => true);

        expect(() => toast.connectionError()).not.toThrow();
        expect(toast.entries.value).toHaveLength(0);
    });

    it('opens an error toast and throws when the device is offline', () => {
        toast.setConnectionResolver(() => false);

        expect(() => toast.connectionError('Offline')).toThrow('Connection for this action is required.');

        expect(toast.entries.value).toHaveLength(1);
        expect(toast.entries.value[0].type).toBe('danger');
        expect(toast.entries.value[0].message).toBe('Offline');
    });

    it('does nothing when toasts are not enabled', () => {
        toast.setComponent(null);
        toast.setConnectionResolver(() => false);

        expect(() => toast.connectionError()).not.toThrow();
        expect(toast.entries.value).toHaveLength(0);
    });
});
