import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import StandardItem from './StandardItem.vue';

function mountItem(onClick?: () => void) {
    return mount(StandardItem, {
        attrs: onClick ? { onClick } : {},
        slots: { default: '<input class="inner" type="text">' }
    });
}

describe('StandardItem keyboard activation', () => {
    it('clicks the row on Enter and Space pressed on the row itself', async () => {
        const onClick = vi.fn();
        const wrapper = mountItem(onClick);

        await wrapper.trigger('keydown.enter');
        await wrapper.trigger('keydown.space');

        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it('ignores Enter and Space pressed inside a control in the row', async () => {
        const onClick = vi.fn();
        const wrapper = mountItem(onClick);
        const input = wrapper.find('input.inner');

        const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
        input.element.dispatchEvent(enter);
        const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        input.element.dispatchEvent(space);

        expect(onClick).not.toHaveBeenCalled();
        expect(enter.defaultPrevented).toBe(false);
        expect(space.defaultPrevented).toBe(false);
    });

    it('does nothing on a row without a click handler', async () => {
        const wrapper = mountItem();
        const click = vi.fn();
        wrapper.element.addEventListener('click', click);

        await wrapper.trigger('keydown.enter');

        expect(click).not.toHaveBeenCalled();
        expect(wrapper.attributes('tabindex')).toBeUndefined();
    });
});
