<template>
    <TablerInput
        v-if='editing'
        ref='editor-input'
        :rows='rows'
        v-model='text'
        :autofocus='true'
        @change='emit("update:modelValue", text)'
        @blur='editing = false'
        @submit='rows > 1 ? undefined : editing = false'
        label=''
    />
    <div
        v-else
        class='position-relative bg-gray-500 rounded-top py-2 px-2 text-truncate'
        :style='rows === 1 ? `height: 44px;` : ``'
        :class='{
            "hover-button hover-border cursor-pointer": hover,
        }'
        @click='edit ? editing = true : undefined'
    >
        <slot />

        <template v-if='rows > 1'>
            <TablerMarkdown
                :markdown='markdown'
            />

            <TablerIconButton
                v-if='edit'
                class='position-absolute'
                :class='{
                    "hover-button-hidden": hover,
                }'
                style='right: 36px; top: 8px;'
            >
                <IconPencil
                    :size='24'
                    stroke='1'
                />
            </TablerIconButton>

            <CopyButton
                :text='text'
                class='position-absolute'
                :size='24'
                style='right: 8px; top: 8px;'
            />
        </template>
        <template v-else>
            <span v-text='text' />

            <IconPencil
                v-if='edit'
                class='position-absolute'
                :class='{
                    "hover-button-hidden": hover,
                }'
                style='right: 36px'
                :size='24'
                stroke='1'
            />

            <CopyButton
                :text='text'
                class='position-absolute'
                :size='24'
                style='right: 8px; top: 6px;'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, computed } from 'vue';
import CopyButton from './CopyButton.vue';
import {
    TablerInput,
    TablerMarkdown,
    TablerIconButton
} from '@tak-ps/vue-tabler'
import {
    IconPencil
} from '@tabler/icons-vue';

const emit = defineEmits([
    'update:modelValue'
]);

const props = defineProps({
    modelValue: {
        type: [String, Number],
        required: true
    },
    rows: {
        type: Number,
        default: 1
    },
    hover: {
        type: Boolean,
        default: false
    },
    edit: {
        type: Boolean,
        default: false
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

const editing = ref(false);
const text = ref(props.modelValue);

const markdown = computed(() => {
    return (props.modelValue || '')
        .replace(/\n/g, '</br>')
        .replace(/(http(s)?:\/\/.*?(\s|$))/g, '[$1]($1) ')
        .trim()
});

watch(props, () => {
    if (text.value !== props.modelValue) {
        text.value = props.modelValue;
    }
})

</script>

<style lang='scss'>
.hover-border {
    border: 2px solid rgba(0, 0, 0, 0);
}

.hover-border:hover {
    border: 2px solid #83b7e8;
}
</style>
