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
            :checked='mode === "u-d-p"'
            @click='mode = "u-d-p"'
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
            :checked='mode === "a-u-G"'
            @click='mode = "a-u-G"'
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
            :checked='mode === "a-f-G"'
            @click='mode = "a-f-G"'
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
            :checked='mode === "a-h-G"'
            @click='mode = "a-h-G"'
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
            :checked='mode === "a-n-G"'
            @click='mode = "a-n-G"'
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

<script lang='ts'>
import {
    IconPoint
} from '@tabler/icons-vue';
export default {
    name: 'CoordinateType',
    components: {
        IconPoint
    },
    props: {
        modelValue: {
            type: String,
            required: true,
        },
        size: {
            type: Number,
            default: 24
        }
    },
    emits: [
        'update:modelValue',
    ],
    data: function() {
        return {
            mode: this.modelValue || 'u-d-p'
        }
    },
    watch: {
        mode: function() {
            this.$emit('update:modelValue', this.mode);
        }
    }
}
</script>
