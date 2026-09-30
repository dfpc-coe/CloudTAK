import { defineComponent, h, ref, nextTick } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PropertyDistance from './PropertyDistance.vue';
import CopyField from '../util/CopyField.vue';

function harness(component: typeof PropertyDistance, unit: string, initial = 0.1) {
    const kilometers = ref(initial);
    const displayUnit = ref(unit);

    const Parent = defineComponent({
        setup() {
            return () => h(component, {
                modelValue: kilometers.value,
                'onUpdate:modelValue': (next: number) => { kilometers.value = next; },
                unit: displayUnit.value,
                edit: true,
            });
        }
    });

    return { wrapper: mount(Parent), kilometers, displayUnit };
}

describe('PropertyDistance', () => {
    let warn: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warn.mockRestore();
    });

    for (const [unit, factor] of [['yard', 0.0009144], ['mile', 1.609344], ['feet', 0.0003048]] as const) {
        it(`typing a 3 digit ${unit} value settles without recursive updates`, async () => {
            const { wrapper, kilometers } = harness(PropertyDistance, unit);

            const field = wrapper.findComponent(CopyField);
            field.vm.$emit('update:modelValue', '999');
            await flushPromises();
            await nextTick();

            expect(kilometers.value).toBeCloseTo(999 * factor, 10);
            expect(Number(field.props('modelValue'))).toBe(999);

            const recursive = warn.mock.calls.filter((call) => String(call[0]).includes('Maximum recursive updates'));
            expect(recursive).toHaveLength(0);
        });
    }

    it('follows an external modelValue change', async () => {
        const { wrapper, kilometers } = harness(PropertyDistance, 'kilometer', 1);

        kilometers.value = 2.5;
        await flushPromises();

        expect(Number(wrapper.findComponent(CopyField).props('modelValue'))).toBe(2.5);
        expect(kilometers.value).toBe(2.5);
    });

    it('follows a unit change without altering the stored kilometers', async () => {
        const { wrapper, kilometers, displayUnit } = harness(PropertyDistance, 'kilometer', 1.609344);

        displayUnit.value = 'mile';
        await flushPromises();

        expect(Number(wrapper.findComponent(CopyField).props('modelValue'))).toBe(1);
        expect(kilometers.value).toBeCloseTo(1.609344, 10);
    });
});
