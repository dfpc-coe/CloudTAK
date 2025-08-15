<template>
    <label
        v-if='label'
        class='mx-1'
        v-text='props.label'
    />

    <div
        v-if='editing'
        class='position-relative rounded-top'
    >
        <TablerInput
            v-model='text'
            :rows='rows'
            :autofocus='true'
            label=''
            :error='error'
            @update:model-value='validUpdate(text)'
            @blur='validUpdate(text, { editing: true })'
            @submit='validUpdate(text, { editing: rows > 1 ? true : false })'
        />

        <TablerIconButton
            v-if='!error'
            title='Done Editing'
            class='position-absolute'
            style='right: 8px; top: 8px;'
            @click.stop.prevent='editing = false'
        >
            <IconCheck
                :size='24'
                stroke='1'
            />
        </TablerIconButton>
    </div>
    <div
        v-else
        ref='infobox'
        class='position-relative bg-gray-500 rounded-top py-2 px-2 text-truncate'
        :style='rows === 1 ? `min-height: ${minheight}px;` : ``'
        :class='{
            "hover-button hover-border cursor-pointer": hover,
        }'
    >
        <slot />

        <template v-if='rows > 1 || mode === "pre"'>
            <TablerMarkdown
                v-if='mode === "text"'
                style='min-height: 32px'
                :markdown='markdown'
            />
            <pre
                v-else
                v-text='text'
            />

            <TablerIconButton
                v-if='edit'
                title='Edit Field'
                class='position-absolute'
                :class='{
                    "hover-button-hidden": hover,
                }'
                style='right: 36px; top: 8px;'
                @click='editing = true'
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

            <TablerIconButton
                v-if='edit'
                title='Edit'
                class='position-absolute'
                :class='{
                    "hover-button-hidden": hover,
                }'
                style='right: 36px; top: 6px;'
                @click='editing = true'
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
                style='right: 8px; top: 6px;'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, computed, useTemplateRef } from 'vue';
import CopyButton from './CopyButton.vue';
import {
    TablerInput,
    TablerMarkdown,
    TablerIconButton
} from '@tak-ps/vue-tabler'
import {
    IconCheck,
    IconPencil
} from '@tabler/icons-vue';

const emit = defineEmits([
    'update:modelValue'
]);

const props = defineProps({
    mode: {
        type: String,
        default: 'text' // text or pre
    },
    label: {
        type: String,
        default: ''
    },
    modelValue: {
        type: [String, Number],
        required: true
    },
    rows: {
        type: Number,
        default: 1
    },
    minheight: {
        type: Number,
        default: 32
    },
    validate: {
        // (text: string | number) => false | string
        type: Function
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
const error = ref<string | undefined>()

const infoboxRef = useTemplateRef<HTMLElement>('infobox');

const markdown = computed(() => {
    return String(props.modelValue || '')
        .replace(/\n/g, '</br>')
        .replace(/(http(s)?:\/\/[a-z-]+[:.].*?(?=[\s"]))/g, '[$1]($1)')
        .trim()
});

watch(infoboxRef, () => {
    if (infoboxRef.value) {
        infoboxRef.value.addEventListener('click', (event: MouseEvent) => {
            if (!props.edit) return;
            if (event.target) {
                const target = event.target as HTMLElement;
                if (['A'].includes(target.tagName)) return;
            }
            editing.value = true;
        });
    }
})

watch(props, () => {
    if (text.value !== props.modelValue && !editing.value) {
        text.value = props.modelValue;
    }
})

function validUpdate(text: string | number, opts = {
    editing: true
}) {
    editing.value = opts.editing;

    if (typeof props.validate !== 'function') {
        emit("update:modelValue", text);
    } else {
        const res = props.validate(text);

        if (res.length) {
            error.value = res;
        } else {
            error.value = undefined;
            emit("update:modelValue", text);
        }
    }
}

</script>

<style lang='scss'>
.hover-border {
    border: 2px solid rgba(0, 0, 0, 0);
}

.hover-border:hover {
    border: 2px solid #83b7e8;
}
</style>
