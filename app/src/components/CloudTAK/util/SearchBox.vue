<template>
    <div
        class='search-box'
        :class='{ "search-box--panel": isPanel }'
    >
        <div
            class='d-flex align-items-end gap-1'
            :class='{ "search-box__header px-2": isPanel }'
        >
            <TablerInput
                v-model='filter'
                :label='props.label'
                :autofocus='props.autofocus'
                :loading='loading'
                class='mt-0 flex-grow-1'
                :placeholder='props.placeholder'
                icon='search'
                @focus='onFocus'
                @keydown='onKeydown'
            />
            <TablerIconButton
                v-if='props.locationPicker'
                class='location-picker-btn mb-1 d-flex align-items-center justify-content-center flex-shrink-0'
                :color='pickingLocation ? "var(--tblr-primary)" : undefined'
                :title='pickingLocation ? "Click on map to select location" : "Select location on map"'
                @click='pickingLocation ? cancelPickingLocation() : startPickingLocation()'
            >
                <IconCrosshair
                    :size='20'
                    stroke='1'
                />
            </TablerIconButton>
        </div>
        <div
            v-if='pickingLocation'
            class='text-secondary small mt-1 px-1'
        >
            Click on the map to select a location
        </div>

        <div
            v-if='isPanel || shown'
            :id='listId'
            ref='listRef'
            role='listbox'
            class='search-box__results'
            :class='isPanel ? "search-box__results--panel" : "dropdown-menu show cloudtak-panel w-100 mt-2 p-1"'
        >
            <template v-if='options.length'>
                <template
                    v-for='group of groups'
                    :key='group.kind'
                >
                    <div
                        class='search-box__group text-secondary text-uppercase fw-semibold px-3 pt-2 pb-1'
                        v-text='group.label'
                    />
                    <div
                        v-for='option of group.options'
                        :id='optionId(option)'
                        :key='option.id'
                        role='option'
                        :aria-selected='option.index === activeIndex'
                        class='search-option d-flex align-items-center gap-3 rounded-2 cursor-pointer'
                        :class='{
                            "search-option--active": option.index === activeIndex,
                            "search-option--feature p-1": option.kind === "feature",
                            "px-2 py-2": option.kind !== "feature"
                        }'
                        @mousemove='activeIndex = option.index'
                        @mousedown.prevent
                        @click='select(option)'
                    >
                        <Feature
                            v-if='option.kind === "feature" && option.cot'
                            :feature='option.cot'
                            :detail='option.detail'
                            :delete-button='false'
                        />
                        <template v-else>
                            <span class='avatar avatar-sm rounded-circle search-option__icon flex-shrink-0'>
                                <component
                                    :is='option.icon'
                                    :size='20'
                                    stroke='1.5'
                                />
                            </span>

                            <div
                                class='flex-grow-1 d-flex flex-column'
                                style='min-width: 0'
                            >
                                <span
                                    class='fw-semibold text-truncate'
                                    v-text='option.label'
                                />
                                <span
                                    v-if='option.detail'
                                    class='text-secondary small text-truncate'
                                    v-text='option.detail'
                                />
                            </div>

                            <kbd
                                v-if='option.index === activeIndex'
                                class='search-box__kbd d-none d-sm-inline-block flex-shrink-0'
                            >↵</kbd>
                        </template>
                    </div>
                </template>
            </template>
            <TablerLoading
                v-else-if='loading'
                :compact='true'
            />
            <div
                v-else-if='isPanel && !filter.trim()'
                class='empty search-box__empty'
            >
                <div class='empty-icon'>
                    <IconMapSearch
                        :size='40'
                        stroke='1'
                    />
                </div>
                <p class='empty-title'>
                    Search the map
                </p>
                <p class='empty-subtitle text-secondary'>
                    Find places, addresses, coordinates, or features by callsign or remarks
                </p>
            </div>
            <TablerNone
                v-else
                :compact='true'
                :create='false'
                label='No Results'
            />
        </div>

        <div
            v-if='isPanel'
            class='search-box__footer d-none d-sm-flex align-items-center gap-3 px-3 py-2 text-secondary small'
        >
            <span class='d-inline-flex align-items-center gap-1'>
                <kbd class='search-box__kbd'>↑</kbd>
                <kbd class='search-box__kbd'>↓</kbd>
                Navigate
            </span>
            <span class='d-inline-flex align-items-center gap-1'>
                <kbd class='search-box__kbd'>↵</kbd>
                Select
            </span>
            <span class='d-inline-flex align-items-center gap-1'>
                <kbd class='search-box__kbd'>Esc</kbd>
                Close
            </span>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { convert } from 'geo-coordinates-parser'
import { v4 as randomUUID } from 'uuid';
import { useRouter } from 'vue-router';
import Feature from './FeatureRow.vue';
import { server } from '../../../std.ts'
import { useMapStore } from '../../../stores/map.ts';
import COT from '../../../base/cot.ts';
import OverlayManager from '../../../base/overlay.ts';
import type { DBOverlay } from '../../../database.ts';
import type { SearchSuggest } from '../../../types.ts';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconMap,
    IconHome,
    IconRoad,
    IconTrees,
    IconShield,
    IconMapPin,
    IconParking,
    IconMailbox,
    IconMountain,
    IconTrekking,
    IconCrosshair,
    IconVector,
    IconCloudPin,
    IconMapSearch,
    IconMapPinStar,
    IconCurrentLocation,
    IconBuildingHospital,
    IconBuildingCommunity
} from '@tabler/icons-vue';
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue';
import type { Component } from 'vue';

type SuggestItem = SearchSuggest['items'][number];
type SearchType = NonNullable<SuggestItem['type']>;
type OptionKind = 'coordinate' | 'feature' | 'overlay' | 'place';

type Option = {
    index: number;
    id: string;
    kind: OptionKind;
    label: string;
    detail?: string;
    icon: Component;
    cot?: COT;
    overlay?: DBOverlay;
    coordinates?: [number, number];
    item?: SuggestItem;
};

const typeIcons: Record<SearchType, Component> = {
    address: IconHome,
    street: IconRoad,
    poi: IconMapPinStar,
    trailhead: IconTrekking,
    parking: IconParking,
    hospital: IconBuildingHospital,
    police: IconShield,
    park: IconTrees,
    peak: IconMountain,
    locality: IconBuildingCommunity,
    region: IconMap,
    postal: IconMailbox
};

const typeLabels: Record<SearchType, string> = {
    address: 'Address',
    street: 'Street',
    poi: 'Point of Interest',
    trailhead: 'Trailhead',
    parking: 'Parking',
    hospital: 'Hospital',
    police: 'Police',
    park: 'Park',
    peak: 'Peak',
    locality: 'City or Town',
    region: 'Region',
    postal: 'Postal Code'
};

const groupLabels: Record<OptionKind, string> = {
    coordinate: 'Coordinates',
    feature: 'Map Features',
    overlay: 'Overlays',
    place: 'Places'
};

function overlayIcon(overlay: DBOverlay): Component {
    if (overlay.type === 'raster' || overlay.type === 'raster-dem') return IconMap;
    if (overlay.type === 'geojson' && overlay.mode === 'mission') return IconCloudPin;
    return IconVector;
}

function overlayDetail(overlay: DBOverlay): string {
    let kind = 'Vector';
    if (overlay.type === 'raster') kind = 'Raster';
    else if (overlay.type === 'raster-dem') kind = 'Terrain';
    else if (overlay.type === 'geojson' && overlay.mode === 'mission') kind = 'Data Sync';

    return overlay.visible ? kind : `${kind} · Hidden`;
}

function typeIcon(type?: SearchType): Component {
    return (type && typeIcons[type]) || IconMapPin;
}

const props = defineProps({
    label: {
        type: String,
        default: ''
    },
    autofocus: {
        type: Boolean,
        default: false
    },
    placeholder: {
        type: String,
        default: 'Search...'
    },
    locationPicker: {
        type: Boolean,
        default: false
    },
    initialValue: {
        type: String,
        default: ''
    },
    variant: {
        type: String as () => 'dropdown' | 'panel',
        default: 'dropdown'
    },
    overlays: {
        type: Boolean,
        default: false
    }
});

const mapStore = useMapStore();

const emit = defineEmits<{
    (e: 'select', value: { name: string, coordinates: [number, number] }): void
    (e: 'close'): void
}>();

const router = useRouter();

const listId = `search-box-${randomUUID()}`;
const isPanel = computed(() => props.variant === 'panel');

const filter = ref('');
const selectedLabel = ref<string | null>(null);
const dismissed = ref(false);
const loading = ref(false);
const pickingLocation = ref(false);
const activeIndex = ref(0);
const listRef = ref<HTMLElement | null>(null);

const coordinate = ref<[number, number] | null>(null);
const cots = ref<Array<{ cot: COT, detail?: string }>>([]);
const overlayMatches = ref<Array<DBOverlay>>([]);
const places = ref<Array<SuggestItem>>([]);

const options = computed<Array<Option>>(() => {
    const list: Array<Option> = [];

    if (coordinate.value) {
        const [lon, lat] = coordinate.value;
        list.push({
            index: list.length,
            id: 'coordinate',
            kind: 'coordinate',
            label: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
            detail: 'Go to coordinate',
            icon: IconCurrentLocation,
            coordinates: [lon, lat]
        });
    }

    for (const { cot, detail } of cots.value) {
        list.push({
            index: list.length,
            id: `feature-${cot.id}`,
            kind: 'feature',
            label: cot.properties.callsign || 'No Callsign',
            detail,
            icon: IconMapPin,
            cot
        });
    }

    for (const overlay of overlayMatches.value) {
        list.push({
            index: list.length,
            id: `overlay-${overlay.id}`,
            kind: 'overlay',
            label: overlay.name,
            detail: overlayDetail(overlay),
            icon: overlayIcon(overlay),
            overlay
        });
    }

    for (const item of places.value) {
        list.push({
            index: list.length,
            id: `place-${item.magicKey}`,
            kind: 'place',
            label: item.text,
            detail: item.type ? typeLabels[item.type] : undefined,
            icon: typeIcon(item.type),
            item
        });
    }

    return list;
});

const groups = computed(() => {
    return (['coordinate', 'feature', 'overlay', 'place'] as const)
        .map((kind) => ({
            kind,
            label: groupLabels[kind],
            options: options.value.filter((option) => option.kind === kind)
        }))
        .filter((group) => group.options.length);
});

const activeOption = computed(() => options.value[activeIndex.value]);

const shown = computed(() => filter.value.trim().length > 0 && !dismissed.value);

function optionId(option: Option): string {
    return `${listId}-${option.index}`;
}

onMounted(() => {
    if (props.initialValue) {
        selectedLabel.value = props.initialValue;
        filter.value = props.initialValue;
        dismissed.value = true;
    }
});

function onFocus(): void {
    if (filter.value !== selectedLabel.value) dismissed.value = false;
}

function startPickingLocation(): void {
    pickingLocation.value = true;
    dismissed.value = true;
    mapStore.map.getCanvas().style.cursor = 'crosshair';

    mapStore.map.once('click', onMapClick);
}

function cancelPickingLocation(): void {
    pickingLocation.value = false;
    mapStore.map.getCanvas().style.cursor = '';
    mapStore.map.off('click', onMapClick);
}

function onMapClick(e: { lngLat: { lng: number, lat: number } }): void {
    pickingLocation.value = false;
    mapStore.map.getCanvas().style.cursor = '';

    const { lng, lat } = e.lngLat;
    applySelection(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, [lng, lat]);
}

onUnmounted(() => {
    if (timer) clearTimeout(timer);

    if (pickingLocation.value) {
        mapStore.map.getCanvas().style.cursor = '';
        mapStore.map.off('click', onMapClick);
    }
});

let timer: ReturnType<typeof setTimeout> | null = null;
let sequence = 0;

watch(filter, (value) => {
    if (timer) clearTimeout(timer);

    if (value === selectedLabel.value) return;

    dismissed.value = false;
    timer = setTimeout(() => search(value), 200);
});

watch(options, () => {
    activeIndex.value = 0;
});

function parseCoordinate(value: string): [number, number] | null {
    try {
        const c = convert(value);
        return [c.decimalLongitude, c.decimalLatitude];
    } catch (e) {
        if (e instanceof Error && !e.message.includes('coordinate')) {
            console.error('Error parsing coordinates:', e);
        }

        return null;
    }
}

const FEATURE_LIMIT = 5;

function remarksSnippet(remarks: string, needle: string): string {
    const text = remarks.replace(/\s+/g, ' ').trim();
    const at = text.toLowerCase().indexOf(needle);
    if (at === -1) return text;

    const start = Math.max(0, at - 30);
    const end = Math.min(text.length, at + needle.length + 60);

    return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

async function searchFeatures(needle: string): Promise<Array<{ cot: COT, detail?: string }>> {
    const cots = await mapStore.worker.db.search(needle, { mission: true, limit: FEATURE_LIMIT });

    return Array.from(cots, (cot) => {
        if ((cot.properties.callsign || '').toLowerCase().includes(needle)) return { cot };
        return { cot, detail: remarksSnippet(cot.properties.remarks || '', needle) };
    });
}

async function search(value: string): Promise<void> {
    const current = ++sequence;
    const text = value.trim();

    coordinate.value = text ? parseCoordinate(text) : null;

    if (!text || coordinate.value) {
        cots.value = [];
        overlayMatches.value = [];
        places.value = [];
        loading.value = false;
        return;
    }

    loading.value = true;

    try {
        const center = mapStore.map.getCenter();

        const [features, matchedOverlays, suggest] = await Promise.all([
            searchFeatures(text.toLowerCase()),
            props.overlays
                ? OverlayManager.list({ filter: text, localFirst: true, limit: 5 })
                : Promise.resolve([]),
            server.GET('/api/search/suggest', {
                params: {
                    query: {
                        query: text,
                        limit: 5,
                        longitude: center.lng,
                        latitude: center.lat
                    }
                }
            })
        ]);

        if (current !== sequence) return;

        if (suggest.error) throw new Error(suggest.error.message);

        cots.value = features;
        overlayMatches.value = matchedOverlays;
        places.value = suggest.data?.items || [];
    } catch (err) {
        if (current !== sequence) return;
        console.error('Search failed:', err);
        cots.value = [];
        overlayMatches.value = [];
        places.value = [];
    } finally {
        if (current === sequence) loading.value = false;
    }
}

function scrollActiveIntoView(): void {
    nextTick(() => {
        const el = listRef.value?.querySelector<HTMLElement>('[aria-selected="true"]');
        if (el && typeof el.scrollIntoView === 'function') {
            el.scrollIntoView({ block: 'nearest' });
        }
    });
}

function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (!options.value.length) return;

        e.preventDefault();

        if (!shown.value) {
            dismissed.value = false;
            return;
        }

        const count = options.value.length;
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        activeIndex.value = (activeIndex.value + delta + count) % count;
        scrollActiveIntoView();
    } else if (e.key === 'Enter') {
        if (!shown.value || !activeOption.value) return;

        e.preventDefault();
        select(activeOption.value, { fly: true });
    } else if (e.key === 'Escape' && !isPanel.value && shown.value) {
        e.preventDefault();
        dismissed.value = true;
    }
}

function applySelection(name: string, coordinates: [number, number]): void {
    selectedLabel.value = name;
    filter.value = name;
    dismissed.value = true;

    emit('select', { name, coordinates });
}

async function addMarker(callsign: string, coordinates: [number, number]): Promise<void> {
    const now = new Date().toISOString();
    const id = randomUUID();

    await mapStore.worker.db.add({
        id,
        type: 'Feature' as const,
        path: '/',
        properties: {
            id,
            callsign,
            type: 'u-d-p',
            how: 'h-g-i-g-o',
            archived: true,
            time: now,
            start: now,
            stale: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            center: coordinates,
            "marker-opacity": 1,
            "marker-color": "#FF0000",
            creator: await mapStore.worker.profile.creator(),
            remarks: 'Created from search result'
        },
        geometry: {
            type: 'Point' as const,
            coordinates
        }
    });
}

async function select(option: Option, opts: { fly?: boolean } = {}): Promise<void> {
    if (option.kind === 'coordinate' && option.coordinates) {
        await selectCoordinate(option.coordinates);
    } else if (option.kind === 'feature' && option.cot) {
        await selectFeature(option.cot, opts.fly === true);
    } else if (option.kind === 'overlay' && option.overlay) {
        await selectOverlay(option.overlay);
    } else if (option.kind === 'place' && option.item) {
        await selectPlace(option.item);
    }
}

async function selectCoordinate(coordinates: [number, number]): Promise<void> {
    const [lon, lat] = coordinates;

    mapStore.map.flyTo({
        center: coordinates,
        zoom: 15
    });

    await addMarker('Search Feature', coordinates);

    applySelection(`${lat.toFixed(5)}, ${lon.toFixed(5)}`, coordinates);
}

async function selectFeature(cot: COT, fly: boolean): Promise<void> {
    if (fly) await cot.flyTo();

    applySelection(cot.properties.callsign, [cot.properties.center[0], cot.properties.center[1]]);
}

async function selectOverlay(overlay: DBOverlay): Promise<void> {
    const loaded = OverlayManager.loadedFrom(overlay.id);

    selectedLabel.value = overlay.name;
    filter.value = overlay.name;
    dismissed.value = true;

    if (!loaded) {
        await router.push('/menu/overlays');
    } else {
        if (!loaded.visible) await loaded.update({ visible: true });
        if (loaded.hasBounds()) await loaded.zoomTo();
    }

    emit('close');
}

async function selectPlace(item: SuggestItem): Promise<void> {
    const center = mapStore.map.getCenter();
    const { data, error } = await server.GET('/api/search/forward', {
        params: {
            query: {
                query: item.text,
                magicKey: item.magicKey,
                longitude: center.lng,
                latitude: center.lat
            }
        }
    });

    if (error) throw new Error(error.message);

    const result = (data?.items || [])[0];
    if (!result) return;

    mapStore.map.fitBounds([
        [result.extent.xmin, result.extent.ymin],
        [result.extent.xmax, result.extent.ymax],
    ], {
        duration: 0,
        padding: {
            top: 25,
            bottom: 25,
            left: 25,
            right: 25
        }
    });

    const coordinates: [number, number] = [result.location.x, result.location.y];

    await addMarker(result.address.split(',')[0].trim(), coordinates);

    applySelection(result.address, coordinates);
}
</script>

<style scoped>
.search-box {
    position: relative;
}

.location-picker-btn {
    width: 2.375rem;
    height: 2.375rem;
    min-width: 2.375rem;
}

.search-box__group {
    font-size: 0.6875rem;
    letter-spacing: 0.06em;
}

.search-option {
    transition: background-color 0.1s ease;
}

.search-option--active {
    background-color: var(--cloudtak-inset-hover-bg, rgba(255, 255, 255, 0.09));
}

.search-option__icon {
    --tblr-avatar-size: 2.25rem;
    color: var(--tblr-body-color);
    background-color: var(--cloudtak-inset-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--cloudtak-inset-border, rgba(255, 255, 255, 0.12));
}

.search-option--active .search-option__icon {
    color: var(--tblr-primary);
    border-color: rgba(var(--tblr-primary-rgb), 0.4);
}

.search-option--feature :deep(.standard-item) {
    margin-bottom: 0 !important;
}

.search-option--active.search-option--feature :deep(.standard-item) {
    border-color: var(--standard-item-hover-border);
    box-shadow: var(--standard-item-shadow);
}

.search-option--active :deep(.feature-row__icon) {
    color: var(--tblr-primary);
    border-color: rgba(var(--tblr-primary-rgb), 0.4);
}

.search-box__kbd {
    padding: 0.125rem 0.375rem;
    font-size: 0.6875rem;
    line-height: 1.25;
}

.search-box__results:not(.search-box__results--panel) {
    max-height: 50vh;
    overflow-y: auto;
}

/* Panel variant: command-palette layout inside a modal */
.search-box--panel {
    --tabler-input-bg: transparent;
}

.search-box--panel .search-box__header {
    border-bottom: 1px solid var(--tblr-border-color);
}

.search-box--panel :deep(.input-group),
.search-box--panel :deep(.input-group .form-control),
.search-box--panel :deep(.input-group .input-group-text) {
    border: 0;
    box-shadow: none;
}

.search-box--panel :deep(.input-group .form-control) {
    font-size: 1.125rem;
    padding: 1rem 0.5rem;
}

.search-box--panel :deep(.input-group-flat:focus-within) {
    box-shadow: none;
}

.search-box__results--panel {
    max-height: min(60vh, 32rem);
    overflow-y: auto;
    padding: 0.25rem 0.5rem 0.5rem;
}

.search-box__empty {
    padding: 2.5rem 1rem;
}

.search-box__footer {
    border-top: 1px solid var(--tblr-border-color);
}
</style>

<style>
.modal-dialog-centered:has(> .modal-content > .search-box--panel) {
    align-items: flex-start;
    padding-top: 8vh;
}
</style>
