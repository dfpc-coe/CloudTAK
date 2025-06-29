<template>
    <div
        class='btn-group'
        role='group'
    >
        <input
            id='point-default'
            type='radio'
            class='btn-check'
            name='point-type'
            autocomplete='off'
            :checked='config.mode === "u-d-p"'
            @click='config.mode = "u-d-p"'
        >
        <label
            v-tooltip='"Custom Point"'
            for='point-default'
            type='button'
            class='btn'
        ><IconPoint
            title='Point Icon'
            :size='size'
            stroke='1'
        /></label>

        <input
            id='point-unknown'
            type='radio'
            class='btn-check'
            name='point-type'
            autocomplete='off'
            :checked='config.mode === "a-u-G"'
            @click='config.mode = "a-u-G"'
        >
        <label
            v-tooltip='"Unknown Point"'
            for='point-unknown'
            type='button'
            class='btn'
        ><img
            :width='size'
            :height='size'
            src='/pngs/a-u-G.png'
        ></label>

        <input
            id='point-friendly'
            type='radio'
            class='btn-check'
            name='point-type'
            autocomplete='off'
            :checked='config.mode === "a-f-G"'
            @click='config.mode = "a-f-G"'
        >
        <label
            v-tooltip='"Friendly Point"'
            for='point-friendly'
            type='button'
            class='btn'
        ><img
            :width='size'
            :height='size'
            src='/pngs/a-f-G.png'
        ></label>

        <input
            id='point-hostile'
            type='radio'
            class='btn-check'
            name='point-type'
            autocomplete='off'
            :checked='config.mode === "a-h-G"'
            @click='config.mode = "a-h-G"'
        >
        <label
            v-tooltip='"Hostile Point"'
            for='point-hostile'
            type='button'
            class='btn'
        ><img
            :width='size'
            :height='size'
            src='/pngs/a-h-G.png'
        ></label>

        <input
            id='point-neutral'
            type='radio'
            class='btn-check'
            name='point-type'
            autocomplete='off'
            :checked='config.mode === "a-n-G"'
            @click='config.mode = "a-n-G"'
        >
        <label
            v-tooltip='"Neutral Point"'
            for='point-neutral'
            type='button'
            class='btn'
        ><img
            :width='size'
            :height='size'
            src='/pngs/a-n-G.png'
        ></label>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import {
    IconPoint
} from '@tabler/icons-vue';

const props = defineProps({
    modelValue: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        default: 24
    }
});

const config = ref({
    mode: props.modelValue || 'u-d-p'
})

const emit = defineEmits([ 'update:modelValue' ])

watch(config.value, () => {
    emit('update:modelValue', config.value.mode);
})
</script>
