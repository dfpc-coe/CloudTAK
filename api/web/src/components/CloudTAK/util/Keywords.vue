<template>
    <div
        v-if='hasContent'
        class='d-flex flex-wrap gap-2 mt-1 align-items-center'
    >
        <TablerBadge
            v-for='keyword in filteredKeywords'
            :key='keyword'
            class='text-uppercase rounded-pill px-3 py-1 small'
            :class='{ "cursor-pointer user-select-none": props.relevant !== undefined }'
            :background-color='hoveredKeyword === keyword ? "rgba(var(--tblr-danger-rgb, 214, 57, 57), 0.15)" : badgeColors.backgroundColor'
            :border-color='hoveredKeyword === keyword ? "rgba(var(--tblr-danger-rgb, 214, 57, 57), 0.5)" : badgeColors.borderColor'
            :text-color='badgeColors.textColor'
            @mouseenter='props.relevant !== undefined ? hoveredKeyword = keyword : undefined'
            @mouseleave='hoveredKeyword = null'
            @click='props.relevant !== undefined ? removeKeyword(keyword) : undefined'
        >
            <span :style='hoveredKeyword === keyword ? "text-decoration: line-through" : undefined'>{{ keyword }}</span>
        </TablerBadge>

        <span
            v-for='keyword in unselectedRelevant.slice(0, 5)'
            :key='"rel-" + keyword'
            class='text-uppercase rounded-pill px-3 py-1 small cursor-pointer user-select-none d-inline-flex align-items-center'
            :style='{
                backgroundColor: badgeColors.backgroundColor,
                border: `1px dashed ${badgeColors.borderColor}`,
                color: badgeColors.textColor,
            }'
            @click='addKeyword(keyword)'
            v-text='keyword'
        />

        <template v-if='props.relevant !== undefined'>
            <form
                v-if='adding'
                class='d-inline-flex'
                @submit.prevent='submitAdd'
            >
                <input
                    ref='addInput'
                    v-model='addText'
                    class='form-control form-control-sm py-0'
                    style='height: 22px; width: 110px; font-size: 0.75rem;'
                    placeholder='keyword...'
                    @keyup.esc='cancelAdd'
                >
            </form>
            <span
                v-else
                class='text-uppercase rounded-pill px-2 py-1 small cursor-pointer user-select-none d-flex align-items-center'
                :style='{
                    backgroundColor: badgeColors.backgroundColor,
                    border: `1px solid ${badgeColors.borderColor}`,
                    color: badgeColors.textColor,
                }'
                title='Add keyword'
                @click='startAdd'
            >
                <IconPlus
                    :size='12'
                    stroke='2'
                />
            </span>
        </template>
    </div>
    <div
        v-else
        class='text-white-50 small fst-italic'
        v-text='props.placeholder'
    />
</template>

<script setup lang="ts">
import { ref, computed, nextTick, useTemplateRef } from 'vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import { IconPlus } from '@tabler/icons-vue';

const FILTERED_PREFIXES = ['template:'];

const emit = defineEmits<{
    'update:keywords': [value: string[]];
}>();

const props = withDefaults(defineProps<{
    keywords?: string[];
    placeholder?: string;
    tone?: 'muted' | 'accent';
    relevant?: string[];
}>(), {
    keywords: () => [],
    placeholder: 'No Keywords',
    tone: 'muted'
});

const filteredKeywords = computed(() => {
    return (props.keywords || []).filter((keyword) => {
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

const badgeColors = computed(() => {
    if (props.tone === 'accent') {
        return {
            backgroundColor: 'rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.18)',
            borderColor: 'rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.42)',
            textColor: 'var(--tblr-primary-text-emphasis, rgb(var(--tblr-primary-rgb, 32, 107, 196)))'
        };
    }

    return {
        backgroundColor: 'rgba(107, 114, 128, 0.2)',
        borderColor: 'rgba(107, 114, 128, 0.5)',
        textColor: '#6b7280'
    };
});

function addKeyword(keyword: string) {
    const current = props.keywords || [];
    if (!current.includes(keyword)) {
        emit('update:keywords', [...current, keyword]);
    }
}

function removeKeyword(keyword: string) {
    emit('update:keywords', (props.keywords || []).filter((k) => k !== keyword));
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
