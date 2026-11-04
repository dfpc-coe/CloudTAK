<template>
    <div v-if='code'>
        <template v-if='isSIDC'>
            <AppearanceStatusSelect
                :model-value='modelValue'
                @update:model-value='emit("update:modelValue", $event)'
            />

            <template v-if='amplifier'>
                <label
                    class='subheader user-select-none d-block pt-2 pb-1'
                    v-text='amplifier.label'
                />
                <TablerEnum
                    :model-value='amplifierLabel'
                    :options='amplifier.options.map((opt) => opt.label)'
                    :default='amplifier.options[0].label'
                    @update:model-value='setAmplifier($event)'
                />
            </template>

            <template v-if='indicators.length'>
                <label class='subheader user-select-none d-block pt-2 pb-1'>Indicators</label>
                <div class='d-flex flex-wrap gap-1'>
                    <button
                        v-for='key of indicators'
                        :key='key'
                        type='button'
                        class='btn btn-sm btn-pill d-inline-flex align-items-center gap-1'
                        :class='flags[key] ? "btn-secondary" : "btn-outline-secondary"'
                        :aria-pressed='flags[key]'
                        @click='toggleIndicator(key)'
                    >
                        <IconCheck
                            v-if='flags[key]'
                            :size='14'
                            stroke='2.5'
                        />
                        <span v-text='HQ_TF_DUMMY_LABELS[key]' />
                    </button>
                </div>
            </template>
        </template>
        <div
            v-else
            class='text-secondary small'
        >
            Status, echelon and indicators are only available for 2525E symbols.
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import Type2525 from '@tak-ps/node-cot/2525';
import { IconCheck } from '@tabler/icons-vue';
import { TablerEnum } from '@tak-ps/vue-tabler';
import AppearanceStatusSelect from './AppearanceStatusSelect.vue';
import {
    HQ_TF_DUMMY_LABELS,
    symbolCode,
    symbolSetOf,
    amplifierOf,
    withAmplifier,
    amplifierOptions,
    hqTfDummyOf,
    withHqTfDummy,
    hqTfDummyOptions,
} from '../../../utils/appearance.ts';
import type { HqTfDummy } from '../../../utils/appearance.ts';

const props = defineProps<{
    modelValue: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', type: string): void;
}>();

const code = computed<string | undefined>(() => symbolCode(props.modelValue));

// Status, amplifier and indicators are 2525E fields - a 2525B CoT type has nowhere to carry them
const isSIDC = computed<boolean>(() => Type2525.isNumericSIDCConvertable(props.modelValue));

const symbolset = computed<string | undefined>(() => symbolSetOf(props.modelValue));

const amplifier = computed(() => amplifierOptions(symbolset.value));

const amplifierLabel = computed<string>(() => {
    const current = amplifierOf(props.modelValue);
    return amplifier.value?.options.find((opt) => opt.value === current)?.label || amplifier.value?.options[0].label || '';
});

const indicators = computed<Array<keyof HqTfDummy>>(() => hqTfDummyOptions(symbolset.value));

const flags = computed<HqTfDummy>(() => hqTfDummyOf(props.modelValue));

function setAmplifier(label: string): void {
    const opt = amplifier.value?.options.find((opt) => opt.label === label);
    if (!opt) return;
    emit('update:modelValue', withAmplifier(props.modelValue, opt.value));
}

function toggleIndicator(key: keyof HqTfDummy): void {
    emit('update:modelValue', withHqTfDummy(props.modelValue, {
        ...flags.value,
        [key]: !flags.value[key]
    }));
}
</script>
