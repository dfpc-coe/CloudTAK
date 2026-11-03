<template>
    <div>
        <label class='subheader user-select-none d-block pb-1'>Marker</label>

        <div
            class='btn-group w-100'
            role='radiogroup'
        >
            <button
                v-for='opt of markers'
                :key='opt.value'
                type='button'
                role='radio'
                class='btn btn-sm'
                :class='opt.value === marker ? "btn-secondary" : "btn-outline-secondary"'
                :aria-checked='opt.value === marker'
                @click='emit("update:marker", opt.value)'
                v-text='opt.label'
            />
        </div>

        <div
            v-if='marker === "symbol"'
            class='d-flex align-items-start gap-2 text-secondary small pt-2'
        >
            <IconInfoCircle
                :size='16'
                stroke='1.5'
                class='flex-shrink-0 mt-1'
            />
            <span>Color and frame come from affiliation. Pick Custom icon or Spot to choose your own color.</span>
        </div>

        <template v-else-if='marker === "icon"'>
            <div class='row g-2 pt-2'>
                <div class='col-6'>
                    <label class='subheader user-select-none d-block pb-1'>Iconset</label>
                    <TablerLoading
                        v-if='loading.sets'
                        :inline='true'
                        desc='Loading Iconsets'
                    />
                    <TablerNone
                        v-else-if='!sets.length'
                        label='No Iconsets Loaded'
                        :compact='true'
                        :create='false'
                    />
                    <TablerEnum
                        v-else
                        :model-value='setName'
                        :options='sets.map((set) => set.name)'
                        @update:model-value='selectSet($event)'
                    />
                </div>
                <div class='col-6'>
                    <label class='subheader user-select-none d-block pb-1'>Icon</label>
                    <TablerInput
                        v-model='iconFilter'
                        placeholder='Filter icons'
                        icon='search'
                    />
                </div>
            </div>

            <TablerLoading
                v-if='loading.icons'
                :inline='true'
                desc='Loading Icons'
            />
            <div
                v-else
                class='icon-grid d-flex flex-wrap gap-1 overflow-y-auto rounded border p-1 mt-2'
            >
                <TablerNone
                    v-if='!filteredIcons.length'
                    label='No Icons Found'
                    :compact='true'
                    :create='false'
                    class='w-100'
                />
                <button
                    v-for='entry of filteredIcons'
                    :key='entry.name'
                    type='button'
                    class='icon-cell rounded d-flex align-items-center justify-content-center'
                    :class='{ active: entry.name === icon }'
                    :title='iconLabel(entry)'
                    @click='emit("update:icon", entry.name)'
                >
                    <img
                        :src='urls.get(entry.name)'
                        :alt='iconLabel(entry)'
                        class='icon-cell__img'
                    >
                </button>
            </div>

            <ColorSwatches
                class='pt-2'
                :model-value='color'
                @update:model-value='emit("update:color", $event)'
            />

            <div class='d-flex align-items-start gap-2 text-secondary small pt-2'>
                <IconInfoCircle
                    :size='16'
                    stroke='1.5'
                    class='flex-shrink-0 mt-1'
                />
                <span>Shown on the map instead of the military symbol. "What it is" stays the same.</span>
            </div>
        </template>

        <template v-else>
            <ColorSwatches
                class='pt-2'
                :model-value='color'
                @update:model-value='emit("update:color", $event)'
            />

            <div class='d-flex align-items-start gap-2 text-secondary small pt-2'>
                <IconInfoCircle
                    :size='16'
                    stroke='1.5'
                    class='flex-shrink-0 mt-1'
                />
                <span>A spot is a plain point in your color - it keeps no type.</span>
            </div>
        </template>

        <label class='subheader user-select-none d-block pt-3 pb-1'>Opacity</label>
        <TablerRange
            :model-value='opacity'
            :default='1'
            :min='0'
            :max='1'
            :step='0.01'
            @update:model-value='emit("update:opacity", Number($event))'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { IconInfoCircle } from '@tabler/icons-vue';
import {
    TablerNone,
    TablerEnum,
    TablerInput,
    TablerRange,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import ColorSwatches from './ColorSwatches.vue';
import Icon from '../../../base/icon.ts';
import Iconset from '../../../base/iconset.ts';
import type { DBIcon, DBIconset } from '../../../database.ts';
import type { Marker } from '../../../utils/appearance.ts';

const MARKERS: Array<{ value: Marker; label: string }> = [
    { value: 'symbol', label: 'Military symbol' },
    { value: 'icon', label: 'Custom icon' },
    { value: 'spot', label: 'Spot' },
];

const props = withDefaults(defineProps<{
    marker: Marker;
    icon?: string;
    color: string;
    opacity: number;
    /** Offer the Spot marker - off for Core Entities whose type is always a symbol */
    spot?: boolean;
}>(), {
    spot: true,
});

const markers = computed(() => MARKERS.filter((opt) => props.spot || opt.value !== 'spot'));

const emit = defineEmits<{
    (e: 'update:marker', marker: Marker): void;
    (e: 'update:icon', icon: string): void;
    (e: 'update:color', color: string): void;
    (e: 'update:opacity', opacity: number): void;
}>();

const loading = ref({ sets: false, icons: false });
const sets = ref<DBIconset[]>([]);
const setUid = ref('');
const icons = ref<DBIcon[]>([]);
const urls = ref<Map<string, string>>(new Map());
const iconFilter = ref('');

const setName = computed<string>(() => sets.value.find((set) => set.uid === setUid.value)?.name || '');

const filteredIcons = computed<DBIcon[]>(() => {
    const f = iconFilter.value.trim().toLowerCase();
    if (!f) return icons.value;
    return icons.value.filter((icon) => icon.path.toLowerCase().includes(f));
});

watch(() => props.marker, async (marker) => {
    if (marker === 'icon') await load();
}, { immediate: true });

watch(() => props.icon, async (icon) => {
    // Picking an icon from a different set (or an initial icon) follows it
    const uid = icon?.split(':')[0];
    if (uid && uid !== setUid.value && sets.value.some((set) => set.uid === uid)) {
        setUid.value = uid;
        await fetchIcons();
    }
});

onMounted(async () => {
    if (props.marker === 'icon') await load();
});

onUnmounted(() => {
    revoke();
});

function iconLabel(icon: DBIcon): string {
    const parts = icon.path.split('/');
    return parts[parts.length - 1].replace(/\.png$/i, '');
}

function revoke(): void {
    for (const url of urls.value.values()) URL.revokeObjectURL(url);
    urls.value = new Map();
}

async function load(): Promise<void> {
    if (sets.value.length) return;

    loading.value.sets = true;

    try {
        sets.value = await Iconset.list();
    } finally {
        loading.value.sets = false;
    }

    const fromIcon = props.icon?.split(':')[0];

    if (fromIcon && sets.value.some((set) => set.uid === fromIcon)) {
        setUid.value = fromIcon;
    } else if (sets.value.length) {
        setUid.value = sets.value[0].uid;
    }

    await fetchIcons();
}

async function selectSet(name: string): Promise<void> {
    const set = sets.value.find((set) => set.name === name);
    if (!set || set.uid === setUid.value) return;

    setUid.value = set.uid;
    await fetchIcons();
}

async function fetchIcons(): Promise<void> {
    if (!setUid.value) {
        icons.value = [];
        return;
    }

    loading.value.icons = true;

    try {
        const uid = setUid.value;
        const list = await Icon.list(uid);
        if (uid !== setUid.value) return;

        revoke();

        const next = new Map<string, string>();
        for (const icon of list) next.set(icon.name, URL.createObjectURL(icon.data));

        icons.value = list;
        urls.value = next;
    } finally {
        loading.value.icons = false;
    }
}
</script>

<style scoped>
.icon-grid {
    max-height: 9.5rem;
}

.icon-cell {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    overflow: hidden;
    border: 1px solid transparent;
    background: transparent;
}

.icon-cell__img {
    width: 28px;
    height: 28px;
    object-fit: contain;
}

.icon-cell:hover {
    background: var(--tblr-bg-surface-secondary, rgba(128, 128, 128, 0.12));
}

.icon-cell.active {
    border-color: var(--tblr-primary);
    background: color-mix(in srgb, var(--tblr-primary) 18%, transparent);
}
</style>
