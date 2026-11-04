<template>
    <div>
        <label
            class='subheader user-select-none d-block pb-1'
            v-text='label'
        />
        <div
            class='d-flex align-items-center flex-wrap gap-2'
            role='radiogroup'
        >
            <button
                v-for='swatch of COLOR_PRESETS'
                :key='swatch.hex'
                type='button'
                role='radio'
                class='color-swatch rounded-circle d-inline-flex align-items-center justify-content-center'
                :class='{ active: isActive(swatch.hex) }'
                :style='{ background: swatch.hex }'
                :title='swatch.label'
                :aria-checked='isActive(swatch.hex)'
                @click='emit("update:modelValue", swatch.hex)'
            >
                <IconCheck
                    v-if='isActive(swatch.hex)'
                    :size='14'
                    stroke='3'
                    :style='{ color: contrast(swatch.hex) }'
                />
            </button>

            <label
                class='color-swatch color-swatch--custom rounded-circle d-inline-flex align-items-center justify-content-center'
                :class='{ active: custom }'
                :style='custom ? { background: modelValue } : {}'
                title='Custom color'
            >
                <IconColorPicker
                    v-if='!custom'
                    :size='14'
                    stroke='1.5'
                />
                <IconCheck
                    v-else
                    :size='14'
                    stroke='3'
                    :style='{ color: contrast(modelValue) }'
                />
                <input
                    type='color'
                    class='visually-hidden'
                    :value='modelValue'
                    @input='emit("update:modelValue", ($event.target as HTMLInputElement).value.toUpperCase())'
                >
            </label>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { IconCheck, IconColorPicker } from '@tabler/icons-vue';
import { COLOR_PRESETS } from '../../../utils/appearance.ts';

const props = withDefaults(defineProps<{
    modelValue: string;
    label?: string;
}>(), {
    label: 'Color',
});

const emit = defineEmits<{
    (e: 'update:modelValue', hex: string): void;
}>();

function isActive(hex: string): boolean {
    return hex.toLowerCase() === (props.modelValue || '').toLowerCase();
}

const custom = computed<boolean>(() => {
    return !!props.modelValue && !COLOR_PRESETS.some((swatch) => isActive(swatch.hex));
});

/** Black or white, whichever reads against the swatch */
function contrast(hex: string): string {
    const value = hex.replace('#', '');
    if (value.length !== 6) return '#000000';

    const r = parseInt(value.substring(0, 2), 16);
    const g = parseInt(value.substring(2, 4), 16);
    const b = parseInt(value.substring(4, 6), 16);

    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#000000' : '#FFFFFF';
}
</script>

<style scoped>
.color-swatch {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 2px solid transparent;
    box-shadow: 0 0 0 1px rgba(128, 128, 128, 0.4);
    cursor: pointer;
}

.color-swatch.active {
    border-color: var(--tblr-body-bg, #1a1a2e);
    box-shadow: 0 0 0 2px var(--tblr-primary);
}

.color-swatch--custom {
    background: var(--tblr-bg-surface-secondary, rgba(128, 128, 128, 0.12));
    margin: 0;
}
</style>
