<template>
    <div
        class='position-relative'
        :class='{
            "bg-gray-500 rounded-top py-2 px-2 text-truncate": !pre
        }'
    >
        <slot />

        <template v-if='pre'>
            <pre v-text='text' />

            <CopyButton
                :text='text'
                class='position-absolute'
                :size='24'
                style='right: 8px; top: 8px;'
            />
        </template>
        <template v-else>
            <span v-text='text' />

            <CopyButton
                :text='text'
                class='position-absolute'
                :size='24'
                style='right: 8px'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import CopyButton from './CopyButton.vue';

defineProps({
    pre: {
        type: Boolean,
        default: false
    },
    text: {
        type: [String, Number],
        required: true
    },
    size: {
        type: Number,
        default: 32
    },
    stroke: {
        type: Number,
        default: 1
    }
})
</script>
