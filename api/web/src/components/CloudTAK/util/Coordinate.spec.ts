import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import Coordinate from './Coordinate.vue';

describe('Coordinate', () => {
    it('emits a single model update when submit follows an input update', async () => {
        const wrapper = mount(Coordinate, {
            props: {
                modelValue: [-104.990251, 39.739236],
                edit: true
            },
            global: {
                directives: {
                    tooltip: () => undefined
                },
                stubs: {
                    CopyField: {
                        name: 'CopyField',
                        template: '<div />',
                        emits: ['submit', 'update:modelValue']
                    },
                    IconLabel: true
                }
            }
        });

        const input = '39.739236, -104.990251';
        const copyField = wrapper.getComponent({ name: 'CopyField' });

        copyField.vm.$emit('update:modelValue', input);
        copyField.vm.$emit('submit', input);
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
        expect(wrapper.emitted('submit')).toEqual([[input]]);
    });
});
