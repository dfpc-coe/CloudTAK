import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PropertyDistance from './PropertyDistance.vue';

function mountDistance() {
    return mount(PropertyDistance, {
        props: {
            modelValue: 1,
            unit: 'kilometer',
            edit: true
        },
        global: {
            directives: {
                tooltip: () => undefined
            },
            stubs: {
                CopyField: {
                    name: 'CopyField',
                    props: ['modelValue'],
                    emits: ['submit', 'update:modelValue'],
                    template: '<div />'
                },
                IconLine: true
            }
        }
    });
}

describe('PropertyDistance', () => {
    it('does not emit model updates when parent props sync local distance', async () => {
        const wrapper = mountDistance();

        await wrapper.setProps({ modelValue: 2 });
        await wrapper.setProps({ unit: 'meter' });

        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('emits model updates for user-entered distance changes', async () => {
        const wrapper = mountDistance();
        const copyField = wrapper.getComponent({ name: 'CopyField' });

        copyField.vm.$emit('update:modelValue', 3);
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('update:modelValue')).toEqual([[3]]);
    });

    it('does not emit model updates when changing display units', async () => {
        const wrapper = mountDistance();
        const meterOption = wrapper.findAll('[role="menuitem"]').find((item) => item.text() === 'Meters');

        await meterOption?.trigger('click');

        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });
});
