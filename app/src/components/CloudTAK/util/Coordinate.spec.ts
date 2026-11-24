import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';

const store = reactive({ coordFormat: 'dd' });

vi.mock('../../../stores/map.ts', () => ({
    useMapStore: () => store
}));

import Coordinate from './Coordinate.vue';

function mountCoordinate(props: Record<string, unknown> = {}) {
    return mount(Coordinate, {
        props: {
            modelValue: [-0.1276, 51.5072],
            ...props
        },
        global: {
            directives: {
                tooltip: () => undefined
            },
            stubs: {
                CopyField: {
                    name: 'CopyField',
                    props: ['modelValue'],
                    template: '<div />',
                    emits: ['submit', 'update:modelValue']
                },
                IconLabel: true
            }
        }
    });
}

describe('Coordinate', () => {
    it('starts in the profile coordinate format', () => {
        store.coordFormat = 'bng';
        const wrapper = mountCoordinate();
        store.coordFormat = 'dd';

        expect(wrapper.getComponent({ name: 'CopyField' }).props('modelValue')).toMatch(/^TQ \d{5} \d{5}$/);
    });

    it('ignores the profile coordinate format when the caller excludes it', () => {
        store.coordFormat = 'bng';
        const wrapper = mountCoordinate({ modes: ['dd'] });
        store.coordFormat = 'dd';

        expect(wrapper.getComponent({ name: 'CopyField' }).props('modelValue')).toBe('51.5072, -0.1276');
    });

    it('only offers the modes defined at the coordinate', async () => {
        const wrapper = mountCoordinate();
        const labels = () => wrapper.findAll('[role="menuitem"]').map((tab) => tab.text());

        expect(labels()).toEqual(['DD', 'DM', 'DMS', 'MGRS', 'UTM', 'BNG']);

        await wrapper.setProps({ modelValue: [-104.990251, 39.739236] });
        expect(labels()).toEqual(['DD', 'DM', 'DMS', 'MGRS', 'UTM']);
    });

    it('falls back while the selected mode is out of bounds and returns to it after', async () => {
        store.coordFormat = 'bng';
        const wrapper = mountCoordinate();
        store.coordFormat = 'dd';

        const shown = () => wrapper.getComponent({ name: 'CopyField' }).props('modelValue');

        await wrapper.setProps({ modelValue: [-104.990251, 39.739236] });
        expect(shown()).toBe('39.739236, -104.990251');

        await wrapper.setProps({ modelValue: [-0.1276, 51.5072] });
        expect(shown()).toMatch(/^TQ /);
    });

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
