<template>
    <IconCopy
        v-if='!copied'
        :size='size'
        :stroke='stroke'
        class='cursor-pointer'
        @click='copy'
    />
    <IconCopyCheck
        v-else
        :size='size'
        :stroke='stroke + 1'
        class='cursor-pointer'
        @click='copy'
    />
</template>

<script>
import {
    IconCopy,
    IconCopyCheck
} from '@tabler/icons-vue';

export default {
    name: 'CopyButton',
    data: function() {
        return {
            copied: false,
            timeout: false,
        }
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
    unmounted: function() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    },
    components: {
        IconCopy,
        IconCopyCheck
    },
    methods: {
        copy: async function() {
            await navigator.clipboard.writeText(String(this.text))
            this.copied = true;

            setTimeout(() => {
                this.copied = false;
            }, 1000);
        }
    }
}
</script>
