<template>
    <div>
        <div class='d-flex align-items-center mb-2'>
            <label class='form-label mb-0'>Slope Classes</label>
            <div class='ms-auto btn-list'>
                <TablerButton
                    class='btn-sm btn-secondary'
                    @click='classes = cloneSlopeClasses()'
                >
                    Reset Defaults
                </TablerButton>
                <TablerButton
                    class='btn-sm btn-primary'
                    :disabled='classes.length >= MAX_SLOPE_CLASSES'
                    @click='addClass'
                >
                    Add Class
                </TablerButton>
            </div>
        </div>

        <div
            v-for='(slope, idx) in classes'
            :key='idx'
            class='row g-2 align-items-end mb-2'
        >
            <div class='col-3'>
                <TablerInput
                    v-model='slope.lower'
                    type='number'
                    label='From °'
                />
            </div>
            <div class='col-3'>
                <TablerInput
                    v-model='slope.upper'
                    type='number'
                    label='To °'
                />
            </div>
            <div class='col-2'>
                <TablerInput
                    v-model='slope.color'
                    type='color'
                    label='Colour'
                />
            </div>
            <div class='col-3'>
                <TablerInput
                    v-model='slope.opacity'
                    type='number'
                    label='Opacity %'
                />
            </div>
            <div class='col-1 pb-1'>
                <TablerIconButton
                    title='Remove Class'
                    @click='classes.splice(idx, 1)'
                >
                    <IconTrash
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <div
            v-if='error'
            class='text-danger small'
            v-text='error'
        />
        <div
            v-else-if='hint'
            class='text-white-50 small'
            v-text='hint'
        />
    </div>
</template>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import { TablerButton, TablerIconButton, TablerInput } from '@tak-ps/vue-tabler';
import { IconTrash } from '@tabler/icons-vue';
import { MAX_SLOPE_CLASSES, cloneSlopeClasses, validateSlopeClasses } from './slope.ts';
import type { SlopeClass } from './slope.ts';

const props = withDefaults(defineProps<{
    modelValue: SlopeClass[];
    hint?: string;
    /** Milliseconds of quiet before a valid edit is emitted */
    debounce?: number;
}>(), {
    hint: '',
    debounce: 0,
});

const emit = defineEmits<{
    'update:modelValue': [value: SlopeClass[]];
}>();

const classes = ref<SlopeClass[]>(cloneSlopeClasses(props.modelValue));
const error = computed(() => validateSlopeClasses(classes.value));

let timer: ReturnType<typeof setTimeout> | undefined;

watch(classes, () => {
    if (error.value) return;

    if (timer) clearTimeout(timer);

    const value = cloneSlopeClasses(classes.value);
    if (props.debounce > 0) {
        timer = setTimeout(() => emit('update:modelValue', value), props.debounce);
    } else {
        emit('update:modelValue', value);
    }
}, { deep: true });

function addClass(): void {
    const last = classes.value[classes.value.length - 1];
    const lower = last ? Math.min(last.upper, 89) : 0;

    classes.value.push({
        lower,
        upper: Math.min(lower + 5, 90),
        color: '#FFFFFF',
        opacity: 78,
    });
}
</script>
