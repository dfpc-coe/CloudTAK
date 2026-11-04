<template>
    <div
        ref='root'
        class='position-relative'
    >
        <label class='subheader user-select-none d-block pb-1'>Type</label>

        <button
            type='button'
            class='type-trigger w-100 d-flex align-items-center rounded border px-2 py-2 text-start'
            :class='{ "type-trigger--open": open }'
            :aria-expanded='open'
            @click='toggle'
        >
            <FeatureIcon
                v-if='modelValue'
                :key='modelValue'
                :size='28'
                :feature='{ properties: { type: withStatus(modelValue, "0") } }'
            />
            <IconChartGridDots
                v-else
                :size='28'
                stroke='1'
                class='text-secondary'
            />

            <div
                class='flex-grow-1 mx-2'
                style='min-width: 0;'
            >
                <template v-if='modelValue'>
                    <div
                        class='text-truncate'
                        v-text='current.title'
                    />
                    <div
                        v-if='current.path.length'
                        class='text-secondary small text-truncate'
                        v-text='current.path.join(" › ")'
                    />
                </template>
                <div
                    v-else
                    class='text-secondary'
                >
                    Choose a type…
                </div>
            </div>

            <IconChevronUp
                v-if='open'
                :size='18'
                stroke='1.5'
            />
            <IconChevronDown
                v-else
                :size='18'
                stroke='1.5'
            />
        </button>

        <div
            v-if='open'
            class='type-panel card position-absolute start-0 end-0 mt-1 shadow'
        >
            <div class='px-2 pt-2'>
                <TablerInput
                    v-model='filter'
                    placeholder='Search all types'
                    icon='search'
                    :autofocus='true'
                />
            </div>

            <div
                class='type-panel__list overflow-y-auto px-1 py-1'
            >
                <TablerLoading
                    v-if='loading'
                    :inline='true'
                    desc='Loading Types'
                />
                <div
                    v-else-if='error'
                    class='d-flex align-items-center px-2 py-2 user-select-none'
                >
                    <span class='text-truncate'>Loading Types Failed</span>
                    <TablerIconButton
                        class='ms-auto'
                        title='Retry'
                        @click.stop='fetchList'
                    >
                        <IconRefresh
                            :size='16'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>

                <!-- Flat search across every Symbol Set, grouped by set -->
                <template v-else-if='filter'>
                    <TablerNone
                        v-if='!groupedItems.length'
                        label='No Types Found'
                        :compact='true'
                        :create='false'
                    />
                    <template
                        v-for='group of groupedItems'
                        :key='group.id'
                    >
                        <div
                            class='type-panel__header subheader px-2 pt-2 pb-1 user-select-none'
                            v-text='group.label'
                        />
                        <button
                            v-for='item of group.items'
                            :key='item.sidc'
                            type='button'
                            class='type-item w-100 d-flex align-items-center rounded px-2 py-1 text-start cloudtak-hover'
                            :title='item.remarks'
                            @click='select(item.sidc)'
                        >
                            <FeatureIcon
                                :key='item.sidc'
                                :size='24'
                                :feature='{ properties: { type: item.sidc } }'
                            />
                            <div
                                class='flex-grow-1 mx-2'
                                style='min-width: 0;'
                            >
                                <div
                                    class='text-truncate'
                                    v-text='item.title'
                                />
                                <div
                                    class='text-secondary small text-truncate'
                                    v-text='itemPath(item).join(" › ")'
                                />
                            </div>
                        </button>
                    </template>

                    <button
                        type='button'
                        class='type-item w-100 d-flex align-items-center rounded px-2 py-2 text-start cloudtak-hover mt-1 border-top'
                        @click='filter = ""'
                    >
                        <IconLayoutGrid
                            :size='20'
                            stroke='1'
                        />
                        <span class='mx-2'>Browse all categories</span>
                        <IconChevronRight
                            :size='16'
                            stroke='1'
                            class='ms-auto'
                        />
                    </button>
                </template>

                <!-- Symbol Sets as browse categories -->
                <template v-else-if='!crumbs.length'>
                    <div class='type-panel__header subheader px-2 pt-2 pb-1 user-select-none'>
                        Symbol sets
                    </div>
                    <button
                        v-for='set of visibleSets'
                        :key='set.id'
                        type='button'
                        class='type-item w-100 d-flex align-items-center rounded px-2 py-1 text-start cloudtak-hover'
                        @click='pushCrumb({ id: set.id, name: symbolSetLabel(set.id, set.name) })'
                    >
                        <FeatureIcon
                            :key='`${affiliation}-${set.id}`'
                            :size='24'
                            :feature='{ properties: { type: setSIDC(set.id) } }'
                        />
                        <span
                            class='flex-grow-1 mx-2 text-truncate'
                            v-text='symbolSetLabel(set.id, set.name)'
                        />
                        <CountBadge
                            :count='set.count'
                            class='me-2'
                        />
                        <IconChevronRight
                            :size='16'
                            stroke='1'
                        />
                    </button>

                    <button
                        v-if='moreSets.length && !showAllSets'
                        type='button'
                        class='type-item w-100 d-flex align-items-center rounded px-2 py-2 text-start cloudtak-hover'
                        @click='showAllSets = true'
                    >
                        <IconDots
                            :size='20'
                            stroke='1'
                        />
                        <span
                            class='flex-grow-1 mx-2 text-truncate'
                            v-text='moreSetsLabel'
                        />
                        <IconChevronDown
                            :size='16'
                            stroke='1'
                        />
                    </button>
                </template>

                <!-- Inside a Symbol Set: Entity => Entity Type => Entity Subtype -->
                <template v-else>
                    <div class='d-flex align-items-center px-1 py-1 user-select-none'>
                        <TablerIconButton
                            title='Back'
                            @click.stop='popCrumb'
                        >
                            <IconChevronLeft
                                :size='20'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <div
                            class='mx-1 subheader text-truncate'
                            v-text='crumbs.map((crumb) => crumb.name).join(" › ")'
                        />
                    </div>

                    <TablerNone
                        v-if='!items.length'
                        label='No Symbols Found'
                        :compact='true'
                        :create='false'
                    />
                    <button
                        v-for='item of items'
                        :key='item.sidc'
                        type='button'
                        class='type-item w-100 d-flex align-items-center rounded px-2 py-1 text-start cloudtak-hover'
                        :title='item.remarks'
                        @click='select(item.sidc)'
                    >
                        <FeatureIcon
                            :key='item.sidc'
                            :size='24'
                            :feature='{ properties: { type: item.sidc } }'
                        />
                        <span
                            class='flex-grow-1 mx-2 text-truncate'
                            v-text='item.title'
                        />
                        <TablerIconButton
                            v-if='item.children'
                            :title='`${item.children} Subtypes`'
                            @click.stop='pushCrumb({ id: entityCode(item.sidc), name: item.title })'
                        >
                            <IconChevronRight
                                :size='16'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </button>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { SID_MAP } from '@tak-ps/node-cot/2525';
import {
    IconDots,
    IconRefresh,
    IconLayoutGrid,
    IconChevronUp,
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChartGridDots,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import FeatureIcon from '../util/FeatureIcon.vue';
import CountBadge from '../util/CountBadge.vue';
import COT from '../../../base/cot.ts';
import { server } from '../../../std.ts';
import type { COT2525EList, COT2525EType } from '../../../types.ts';
import {
    PRIMARY_SYMBOL_SETS,
    symbolSetLabel,
    splitTypeName,
    withAffiliation,
    withStatus,
} from '../../../utils/appearance.ts';

type SymbolSet = COT2525EList['symbolsets'][number];

const props = defineProps<{
    /** Current type - a CoT Atom type or numeric SIDC, unset for an untyped point */
    modelValue?: string;
    /** Affiliation code the listed symbols are rendered with */
    affiliation: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', sidc: string): void;
}>();

const root = useTemplateRef<HTMLElement>('root');

const open = ref(false);
const filter = ref('');
const loading = ref(false);
const error = ref(false);
const showAllSets = ref(false);

const sets = ref<SymbolSet[]>([]);
const items = ref<COT2525EType[]>([]);
const crumbs = ref<Array<{ id: string; name: string }>>([]);

const current = ref<{ title: string; path: string[] }>({ title: '', path: [] });

const primarySets = computed<SymbolSet[]>(() => {
    return PRIMARY_SYMBOL_SETS
        .map((id) => sets.value.find((set) => set.id === id))
        .filter((set): set is SymbolSet => !!set);
});

const moreSets = computed<SymbolSet[]>(() => {
    return sets.value.filter((set) => !PRIMARY_SYMBOL_SETS.includes(set.id));
});

const visibleSets = computed<SymbolSet[]>(() => {
    return showAllSets.value ? [...primarySets.value, ...moreSets.value] : primarySets.value;
});

const moreSetsLabel = computed<string>(() => {
    const names = moreSets.value.slice(0, 3).map((set) => symbolSetLabel(set.id, set.name).split(' - ')[0]);
    return [...new Set(names)].join(', ') + '…';
});

const groupedItems = computed(() => {
    const groups = new Map<string, { id: string; label: string; items: COT2525EType[] }>();

    for (const item of items.value) {
        let group = groups.get(item.symbolset);

        if (!group) {
            const set = sets.value.find((set) => set.id === item.symbolset);
            group = { id: item.symbolset, label: symbolSetLabel(item.symbolset, set?.name), items: [] };
            groups.set(item.symbolset, group);
        }

        group.items.push(item);
    }

    return [...groups.values()];
});

let filterTimeout: ReturnType<typeof setTimeout> | undefined;

watch(filter, () => {
    if (filterTimeout) clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => void fetchList(), 150);
});

watch(() => props.affiliation, async () => {
    if (open.value) await fetchList();
});

watch(() => props.modelValue, async () => {
    await resolveCurrent();
}, { immediate: true });

onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown);
});

onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDown);
    if (filterTimeout) clearTimeout(filterTimeout);
});

function onPointerDown(event: PointerEvent): void {
    if (open.value && root.value && !root.value.contains(event.target as Node)) {
        open.value = false;
    }
}

async function toggle(): Promise<void> {
    open.value = !open.value;

    if (open.value) await fetchList();
}

function setSIDC(set: string): string {
    const sid = SID_MAP[props.affiliation.toUpperCase()] || '01';
    return `13${sid}${set}00000000000000`;
}

function entityCode(sidc: string): string {
    return sidc.substring(10, 16);
}

/** Symbol Set then the name levels above the most specific one */
function itemPath(item: COT2525EType): string[] {
    const set = sets.value.find((set) => set.id === item.symbolset);
    const levels = item.name.split(' - ').map((level) => level.trim()).filter(Boolean);
    return [symbolSetLabel(item.symbolset, set?.name), ...levels.slice(0, -1)];
}

function select(sidc: string): void {
    emit('update:modelValue', withAffiliation(sidc, props.affiliation));
    open.value = false;
    filter.value = '';
}

async function pushCrumb(crumb: { id: string; name: string }): Promise<void> {
    crumbs.value.push(crumb);
    await fetchList();
}

async function popCrumb(): Promise<void> {
    crumbs.value.pop();
    await fetchList();
}

async function resolveCurrent(): Promise<void> {
    if (!props.modelValue) {
        current.value = { title: '', path: [] };
        return;
    }

    const type = props.modelValue;
    const resolved = await COT.resolveType(type);

    if (type === props.modelValue) {
        current.value = splitTypeName(type, resolved.name);
    }
}

async function fetchList(): Promise<void> {
    loading.value = true;
    error.value = false;

    try {
        const query: {
            filter: string;
            identity: string;
            limit: number;
            symbolset?: string;
            parent?: string;
        } = {
            filter: filter.value,
            identity: props.affiliation,
            limit: 100
        };

        // Listing the sets alone needs no symbols
        if (!filter.value && !crumbs.value.length) query.limit = 1;

        if (!filter.value && crumbs.value.length) {
            query.symbolset = crumbs.value[0].id;

            if (crumbs.value.length > 1) {
                query.parent = crumbs.value[crumbs.value.length - 1].id;
            }
        }

        const { data, error: err } = await server.GET('/api/type/2525e', {
            params: {
                // @ts-expect-error Types are loose
                query
            }
        });

        if (err) throw new Error(String(err));

        sets.value = data.symbolsets;
        items.value = (filter.value || crumbs.value.length) ? data.items : [];
    } catch (err) {
        console.error('Failed to load 2525E Types:', err);
        error.value = true;
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.type-trigger {
    background: var(--tblr-bg-surface, transparent);
    color: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
}

.type-trigger:hover,
.type-trigger:focus-visible {
    border-color: var(--cloudtak-hover-border);
    background: var(--cloudtak-hover-bg);
}

.type-trigger--open {
    border-color: var(--tblr-primary) !important;
}

.type-panel {
    z-index: 1030;
}

.type-panel__list {
    max-height: 22rem;
}

.type-panel__header {
    font-size: 0.7rem;
}

.type-item {
    border: 0;
    background: transparent;
    color: inherit;
}
</style>
