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
                        :options='setNames'
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

            <button
                v-if='icon'
                type='button'
                class='btn btn-sm btn-ghost-secondary d-flex align-items-center gap-1 mt-1'
                :aria-pressed='isFavorite(icon)'
                @click='toggleFavorite(icon)'
            >
                <component
                    :is='isFavorite(icon) ? IconStarFilled : IconStar'
                    :size='16'
                    stroke='1.5'
                    :class='{ "text-yellow": isFavorite(icon) }'
                />
                <span v-text='isFavorite(icon) ? "Remove from Favorites" : "Add to Favorites"' />
            </button>

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
import { computed, watch } from 'vue';
import { IconInfoCircle, IconStar, IconStarFilled } from '@tabler/icons-vue';
import {
    TablerNone,
    TablerEnum,
    TablerInput,
    TablerRange,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import ColorSwatches from './ColorSwatches.vue';
import Icon from '../../../base/icon.ts';
import { useIconsetIcons } from '../../../utils/iconset-icons.ts';
import type { DBIcon } from '../../../database.ts';
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
    icon: undefined,
    spot: true,
});

const markers = computed(() => MARKERS.filter((opt) => props.spot || opt.value !== 'spot'));

const emit = defineEmits<{
    (e: 'update:marker', marker: Marker): void;
    (e: 'update:icon', icon: string): void;
    (e: 'update:color', color: string): void;
    (e: 'update:opacity', opacity: number): void;
}>();

const {
    loading, sets, setName, setNames, filter: iconFilter, filtered: filteredIcons, urls, load, follow, selectSet,
    isFavorite, toggleFavorite
} = useIconsetIcons();

watch(() => props.marker, async (marker) => {
    if (marker === 'icon') await load(props.icon);
}, { immediate: true });

watch(() => props.icon, follow);

function iconLabel(icon: DBIcon): string {
    return Icon.leaf(icon.path);
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
