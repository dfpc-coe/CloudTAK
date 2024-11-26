<template>
    <template v-if='editing'>
        <TablerInput
            ref='editor-input'
            v-model='text'
            :autofocus='true'
            label=''
        />
    </template>
    <div
        v-else
        class='position-relative'
        :class='{
            "bg-gray-500 rounded-top py-2 px-2 text-truncate": !pre,
            "hover-button hover-border cursor-pointer": hover,
        }'
        @click='edit ? editing = true : undefined'
    >
        <slot />

        <template v-if='pre'>
            <pre v-text='text' />

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
import { ref, watch } from 'vue';
import CopyButton from './CopyButton.vue';
import {
    TablerInput,
    TablerIconButton
} from '@tak-ps/vue-tabler'
import {
    IconPencil
} from '@tabler/icons-vue';

const props = defineProps({
    modelValue: {
        type: [String, Number],
        required: true
    },
    pre: {
        type: Boolean,
        default: false
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

watch(props, () => {
    text.value = props.modelValue;
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
