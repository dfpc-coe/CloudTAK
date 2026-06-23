<template>
    <div
        v-if='hasContent'
        class='d-flex flex-column gap-2 mt-1'
    >
        <div
            v-if='filteredKeywords.length > 0'
            class='d-flex flex-wrap gap-2 align-items-center'
        >
            <TablerBadge
                v-for='keyword in filteredKeywords'
                :key='keyword'
                class='text-uppercase rounded-pill px-3 py-1'
                :class='{ "cursor-pointer user-select-none": props.relevant !== undefined }'
                :background-color='COLORS.primary.bg'
                :border-color='COLORS.primary.border'
                :text-color='COLORS.primary.text'
                :hover-background-color='props.relevant !== undefined ? COLORS.danger.bg : undefined'
                :hover-border-color='props.relevant !== undefined ? COLORS.danger.border : undefined'
                :hover-text-color='props.relevant !== undefined ? COLORS.danger.text : undefined'
                @mouseenter='props.relevant !== undefined ? hoveredKeyword = keyword : undefined'
                @mouseleave='hoveredKeyword = null'
                @click='props.relevant !== undefined ? removeKeyword(keyword) : undefined'
            >
                <span :class='{ "text-decoration-line-through": hoveredKeyword === keyword }'>{{ keyword }}</span>
            </TablerBadge>
        </div>

        <div
            v-if='unselectedRelevant.length > 0 || props.relevant !== undefined'
            class='d-flex flex-column gap-2'
        >
            <template v-if='unselectedRelevant.length > 0'>
                <span class='text-white-50 small fst-italic'>Suggested</span>

                <div class='d-flex flex-wrap gap-2 align-items-center'>
                    <TablerBadge
                        v-for='keyword in unselectedRelevant.slice(0, 5)'
                        :key='"rel-" + keyword'
                        class='text-uppercase rounded-pill px-3 py-1 cursor-pointer user-select-none'
                        :background-color='COLORS.muted.bg'
                        :border-color='COLORS.muted.border'
                        :text-color='COLORS.muted.text'
                        :hover-background-color='COLORS.primary.bg'
                        :hover-border-color='COLORS.primary.border'
                        :hover-text-color='COLORS.primary.text'
                        @click='addKeyword(keyword)'
                    >
                        {{ keyword }}
                    </TablerBadge>
                </div>
            </template>

            <template v-if='props.relevant !== undefined'>
                <form
                    v-if='adding'
                    class='d-inline-flex'
                    @submit.prevent='submitAdd'
                >
                    <input
                        ref='addInput'
                        v-model='addText'
                        class='kw-input form-control form-control-sm py-0'
                        placeholder='keyword...'
                        @keyup.esc='cancelAdd'
                    >
                </form>
                <TablerBadge
                    v-else
                    class='text-uppercase rounded-pill px-3 py-1 cursor-pointer user-select-none d-inline-flex align-items-center gap-1'
                    :background-color='COLORS.success.bg'
                    :border-color='COLORS.success.border'
                    :text-color='COLORS.success.text'
                    title='Add keyword'
                    @click='startAdd'
                >
                    <IconPlus
                        :size='12'
                        stroke='2'
                    />
                    New Keyword
                </TablerBadge>
            </template>
        </div>
    </div>
    <div
        v-else
        class='text-white-50 small fst-italic'
        v-text='placeholder'
    />
</template>

<script setup lang="ts">
import { ref, computed, nextTick, useTemplateRef } from 'vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import { IconPlus } from '@tabler/icons-vue';

const FILTERED_PREFIXES = ['template:'];

const COLORS = {
    primary: {
        bg: 'rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.15)',
        border: 'rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.5)',
        text: 'var(--tblr-primary, rgb(32, 107, 196))',
    },
    danger: {
        bg: 'rgba(var(--tblr-danger-rgb, 214, 57, 57), 0.15)',
        border: 'rgba(var(--tblr-danger-rgb, 214, 57, 57), 0.5)',
        text: 'var(--tblr-danger, rgb(214, 57, 57))',
    },
    success: {
        bg: 'rgba(var(--tblr-success-rgb, 47, 179, 135), 0.15)',
        border: 'rgba(var(--tblr-success-rgb, 47, 179, 135), 0.5)',
        text: 'var(--tblr-success, #2fb387)',
    },
    muted: {
        bg: 'rgba(107, 114, 128, 0.2)',
        border: 'rgba(107, 114, 128, 0.55)',
        text: '#6b7280',
    },
} as const;

const emit = defineEmits<{
    'update:keywords': [value: string[]];
}>();

const props = withDefaults(defineProps<{
    keywords?: string[];
    placeholder?: string;
    relevant?: string[];
}>(), {
    keywords: () => [],
    placeholder: 'No Keywords',
});

const { placeholder } = props;

const filteredKeywords = computed(() => {
    return props.keywords.filter((keyword) => {
        return FILTERED_PREFIXES.some((prefix) => keyword.startsWith(prefix)) === false;
    });
});

const unselectedRelevant = computed(() => {
    if (props.relevant === undefined) return [];
    return props.relevant.filter((keyword) => {
        return FILTERED_PREFIXES.some((prefix) => keyword.startsWith(prefix)) === false
            && !filteredKeywords.value.includes(keyword);
    });
});

const hasContent = computed(() => {
    return filteredKeywords.value.length > 0
        || unselectedRelevant.value.length > 0
        || props.relevant !== undefined;
});

const adding = ref(false);
const addText = ref('');
const addInput = useTemplateRef<HTMLInputElement>('addInput');
const hoveredKeyword = ref<string | null>(null);

function addKeyword(keyword: string) {
    if (!props.keywords.includes(keyword)) {
        emit('update:keywords', [...props.keywords, keyword]);
    }
}

function removeKeyword(keyword: string) {
    emit('update:keywords', props.keywords.filter((k) => k !== keyword));
}

function startAdd() {
    adding.value = true;
    addText.value = '';
    nextTick(() => addInput.value?.focus());
}

function submitAdd() {
    const kw = addText.value.trim();
    if (kw) addKeyword(kw);
    cancelAdd();
}

function cancelAdd() {
    adding.value = false;
    addText.value = '';
}
</script>

<style scoped>
.kw-input {
    height: 22px;
    width: 110px;
    font-size: 0.75rem;
}
</style>
