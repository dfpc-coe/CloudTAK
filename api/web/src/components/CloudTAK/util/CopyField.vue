<template>
    <div
        class='bg-gray-500 rounded-top py-2 px-2 position-relative text-truncate'
    >
        <span v-text='text' />
        <CopyButton
            :text='text'
            class='position-absolute'
            :size='24'
            style='right: 8px'
        />
    </div>
</template>

<script>
import CopyButton from './CopyButton.vue';

export default {
    name: 'CopyField',
    components: {
        CopyButton
    },
    props: {
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
    },
}
</script>
