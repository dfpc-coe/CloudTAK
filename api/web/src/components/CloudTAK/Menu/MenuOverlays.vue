<template>
    <MenuTemplate name='Overlays'>
        <template #buttons>
            <TablerIconButton
                :class='{
                    "pe-none": !isDraggable && !canEditOrder,
                    "opacity-50": !isDraggable && !canEditOrder
                }'
                :title='reorderButtonTitle'
                @click='handleReorderToggle'
            >
                <IconPencil
                    v-if='!isDraggable'
                    :size='32'
                    stroke='1'
                />
                <IconPencilCheck
                    v-else
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='!isDraggable'
                title='Add Overlay'
                @click='router.push("/menu/datas")'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <template #default>
            <div class='d-flex flex-column gap-3'>
                <div class='mt-2 d-flex align-items-center gap-3 flex-wrap'>
                    <TablerInput
                        v-model='overlayFilter'
                        placeholder='Search overlays...'
                        icon='search'
                        class='flex-grow-1'
                    />
                </div>

                <p
                    v-if='showDragHint'
                    class='small mb-0 text-white-50'
                >
                    {{ dragHintCopy }}
                </p>

                <TablerLoading v-if='loading || !isLoaded' />

                <template v-else>
                    <div
                        v-if='overlayCards.length'
                        ref='sortableRef'
                        class='d-flex flex-column gap-3'
                    >
                        <StandardItem
                            v-for='card in overlayCards'
                            :id='String(card.overlay.id)'
                            :key='card.overlay.id'
                            class='p-3'
                            :class='{
                                "border-primary": isDraggable
                            }'
                            :hover='!isDraggable && card.overlay.id !== 0'
                            @click='handleCardClick(card.overlay.id)'
                        >
                            <div
                                class='d-flex justify-content-between gap-3'
                            >
                                <div
                                    class='d-flex align-items-center gap-2 flex-grow-1 w-100 overflow-hidden'
                                    :aria-disabled='isDraggable || card.overlay.id === 0'
                                >
                                    <IconGripVertical
                                        v-if='isDraggable'
                                        v-tooltip='"Drag to reorder"'
                                        class='drag-handle cursor-move text-white-50'
                                        role='button'
                                        tabindex='0'
                                        :size='20'
                                        stroke='1'
                                    />
                                    <IconMap
                                        v-if='card.overlay.type === "raster"'
                                        v-tooltip='"Raster"'
                                        :size='20'
                                        stroke='1'
                                        class='flex-shrink-0 text-white-50'
                                    />
                                    <IconMap
                                        v-else-if='card.overlay.type === "raster-dem"'
                                        v-tooltip='"Terrain"'
                                        :size='20'
                                        stroke='1'
                                        class='flex-shrink-0 text-white-50'
                                    />
                                    <IconAmbulance
                                        v-else-if='card.overlay.type === "geojson" && card.overlay.mode === "mission"'
                                        v-tooltip='"Data Sync"'
                                        :size='20'
                                        stroke='1'
                                        class='flex-shrink-0 text-white-50'
                                    />
                                    <IconVector
                                        v-else
                                        v-tooltip='"Vector"'
                                        :size='20'
                                        stroke='1'
                                        class='flex-shrink-0 text-white-50'
                                    />

                                    <div class='flex-grow-1 w-100 overflow-hidden'>
                                        <div class='d-flex align-items-center gap-2 w-100'>
                                            <div class='d-flex align-items-center flex-grow-1 w-100'>
                                                <a
                                                    v-if='card.overlay.mode === "mission"'
                                                    class='fw-semibold text-decoration-underline d-inline-flex align-items-center text-break'
                                                    @click.stop='router.push(`/menu/missions/${card.overlay.mode_id}`)'
                                                    v-text='card.overlay.name'
                                                />
                                                <span
                                                    v-else
                                                    class='fw-semibold d-inline-flex align-items-center flex-grow-1 text-break'
                                                    v-text='card.overlay.name'
                                                />
                                            </div>
                                        </div>
                                        <div
                                            v-if='card.badges.length'
                                            class='d-flex flex-wrap gap-2 mt-2'
                                        >
                                            <span
                                                v-for='badge in card.badges'
                                                :key='`${card.overlay.id}-${badge.label}`'
                                                class='badge rounded-pill'
                                                :class='`text-bg-${badge.variant}`'
                                            >
                                                {{ badge.label }}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style='min-width: 100px;'
                                    class='d-flex flex-column align-items-end gap-2'
                                >
                                    <span
                                        class='badge rounded-pill'
                                        :class='`text-bg-${card.status.variant}`'
                                        :title='card.status.tooltip || ""'
                                    >
                                        {{ card.status.label }}
                                    </span>

                                    <div class='d-flex align-items-center gap-2 flex-wrap justify-content-end w-100'>
                                        <TablerIconButton
                                            v-if='card.overlay.hasBounds()'
                                            title='Zoom To Overlay'
                                            @click.stop.prevent='card.overlay.zoomTo()'
                                        >
                                            <IconMaximize
                                                :size='20'
                                                stroke='1'
                                            />
                                        </TablerIconButton>

                                        <TablerIconButton
                                            v-if='card.visible'
                                            title='Hide Layer'
                                            @click.stop.prevent='void updateOverlay(card.overlay, { visible: !card.visible })'
                                        >
                                            <IconEye
                                                :size='20'
                                                stroke='1'
                                            />
                                        </TablerIconButton>

                                        <TablerIconButton
                                            v-else
                                            title='Show Layer'
                                            @click.stop.prevent='void updateOverlay(card.overlay, { visible: !card.visible })'
                                        >
                                            <IconEyeOff
                                                :size='20'
                                                stroke='1'
                                            />
                                        </TablerIconButton>

                                        <TablerDelete
                                            v-if='["mission", "data", "profile", "overlay"].includes(card.overlay.mode)'
                                            :key='card.overlay.id'
                                            v-tooltip='"Delete Overlay"'
                                            :size='20'
                                            role='button'
                                            tabindex='0'
                                            displaytype='icon'
                                            @delete='removeOverlay(card.overlay.id)'
                                        />
                                    </div>
                                </div>
                            </div>

                            <div
                                v-if='!isDraggable && opened.has(card.overlay.id)'
                                class='mt-3 p-3 rounded-3 border border-white border-opacity-10 bg-black bg-opacity-25'
                                @click.stop
                            >
                                <div
                                    v-if='card.overlay.type === "raster"'
                                    class='mb-3'
                                >
                                    <TablerRange
                                        :model-value='card.overlay.opacity'
                                        label='Opacity'
                                        :min='0'
                                        :max='1'
                                        :step='0.1'
                                        @update:model-value='void updateOverlay(card.overlay, { opacity: $event })'
                                    />
                                </div>
                                <div
                                    v-if='card.overlay.type === "raster-dem"'
                                    class='mb-3'
                                >
                                    <TablerEnum
                                        :model-value='card.overlay.encoding || "mapbox"'
                                        label='Terrain Encoding'
                                        :options='["mapbox", "terrarium"]'
                                        @update:model-value='void updateOverlay(card.overlay, { encoding: $event })'
                                    />
                                </div>
                                <div
                                    v-if='card.overlay.type === "geojson" && card.overlay.id === -1'
                                    class='mb-3'
                                >
                                    <TreeCots
                                        :element='card.overlay'
                                    />
                                </div>
                                <div
                                    v-if='card.overlay.mode === "mission"'
                                    class='mb-3'
                                >
                                    <TreeMission
                                        :overlay='card.overlay'
                                    />
                                </div>
                                <TreeVector
                                    v-if='card.overlay.type === "vector"'
                                    :overlay='card.overlay'
                                />
                            </div>
                        </StandardItem>
                    </div>

                    <TablerNone
                        v-else
                        label='No overlays match your search'
                        :create='false'
                    />
                </template>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, useTemplateRef, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import type { Subscription } from 'dexie';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerDelete,
    TablerEnum,
    TablerIconButton,
    TablerInput,
    TablerLoading,
    TablerNone,
    TablerRange
} from '@tak-ps/vue-tabler';
import TreeCots from './Overlays/TreeCots.vue';
import TreeVector from './Overlays/TreeVector.vue';
import TreeMission from './Overlays/TreeMission.vue';
import {
    IconGripVertical,
    IconAmbulance,
    IconMaximize,
    IconVector,
    IconEyeOff,
    IconPencil,
    IconPencilCheck,
    IconPlus,
    IconEye,
    IconMap
} from '@tabler/icons-vue';
import StandardItem from '../util/StandardItem.vue';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs';
import { useMapStore } from '../../../../src/stores/map.ts';
import type Overlay from '../../../../src/base/overlay-class.ts';
import type { DBOverlay } from '../../../../src/database.ts';
import OverlayManager from '../../../../src/base/overlay.ts';

type OverlayBadge = { label: string; variant: string };
type OverlayStatus = { label: string; variant: string; tooltip?: string };
type OverlayUpdate = Parameters<Overlay['update']>[0];
type OverlayCard = { overlay: Overlay; visible: boolean; status: OverlayStatus; badges: OverlayBadge[] };

const mapStore = useMapStore();
const router = useRouter();

let sortable: Sortable | undefined;

const isDraggable = ref(false);
const loading = ref(false);
const opened = ref<Set<number>>(new Set());
const overlayFilter = ref('');
const overlayRenderTick = ref(0);

const isLoaded = mapStore.isLoaded;
const dbOverlays = ref<DBOverlay[]>([]);

let listSubscription: Subscription | undefined;

const sortableRef = useTemplateRef<HTMLElement>('sortableRef');

const hasSearchTerm = computed(() => overlayFilter.value.trim().length > 0);

function overlayMatchesTerm(overlay: Overlay, term: string): boolean {
    return (
        (overlay.name ?? '').toLowerCase().includes(term)
        || (overlay.type ?? '').toLowerCase().includes(term)
        || (overlay.mode ?? '').toLowerCase().includes(term)
    );
}

const overlayCards = computed<OverlayCard[]>(() => {
    void overlayRenderTick.value;

    const term = overlayFilter.value.trim().toLowerCase();
    const seen = new Set<number>();
    const cards: OverlayCard[] = [];

    const consider = (overlay: Overlay | undefined): void => {
        if (!overlay || seen.has(overlay.id)) return;
        seen.add(overlay.id);
        if (term && !overlayMatchesTerm(overlay, term)) return;

        cards.push({
            overlay,
            visible: overlay.visible,
            status: resolveOverlayStatus(overlay),
            badges: getOverlayBadges(overlay)
        });
    };

    // Database-backed overlays drive membership and ordering (pos)
    for (const record of dbOverlays.value) {
        consider(OverlayManager.loadedFrom(record.id));
    }

    // Internal / loaded-only overlays (e.g. the "Map Features" overlay) are
    // never persisted to the database, so merge them in from the loaded set
    for (const overlay of OverlayManager.loaded) {
        consider(overlay);
    }

    return cards;
});

const overlayCount = computed(() => overlayCards.value.length);

const canEditOrder = computed(() => !hasSearchTerm.value && overlayCount.value > 1);

const showDragHint = computed(() => overlayCount.value > 1 && !isDraggable.value && !canEditOrder.value);

const dragHintCopy = computed(() => {
    if (!showDragHint.value) return '';
    return 'Reordering available once you clear the search.';
});

const reorderButtonTitle = computed(() => {
    if (isDraggable.value) return 'Save Order';
    if (!canEditOrder.value) {
        if (overlayCount.value <= 1) return 'Add another overlay to reorder';
        return 'Clear the search to reorder overlays';
    }
    return 'Edit Order';
});

function subscribeList(): void {
    listSubscription?.unsubscribe();
    loading.value = true;

    listSubscription = OverlayManager.liveList().subscribe({
        next: (items) => {
            dbOverlays.value = items as DBOverlay[];
            loading.value = false;
        },
        error: (err: unknown) => {
            console.error('Failed to load overlays:', err);
            dbOverlays.value = [];
            loading.value = false;
        }
    });
}

onMounted(() => {
    subscribeList();
});

watch(overlayFilter, () => {
    if (isDraggable.value && !canEditOrder.value) {
        isDraggable.value = false;
    }
});

watch(
    () => ({
        container: sortableRef.value,
        draggable: isDraggable.value,
        hasSearch: hasSearchTerm.value
    }),
    ({ container, draggable, hasSearch }) => {
        const canSort = !!container && draggable && !hasSearch;
        if (canSort && container) {
            if (sortable && sortable.el === container) return;
            if (sortable) sortable.destroy();
            sortable = new Sortable(container, {
                sort: true,
                handle: '.drag-handle',
                dataIdAttr: 'id',
                onEnd: saveOrder
            });
        } else if (sortable) {
            sortable.destroy();
            sortable = undefined;
        }
    },
    { immediate: true }
);

onBeforeUnmount(() => {
    listSubscription?.unsubscribe();
    listSubscription = undefined;

    if (sortable) {
        sortable.destroy();
        sortable = undefined;
    }
});

function handleReorderToggle() {
    if (isDraggable.value) {
        isDraggable.value = false;
        return;
    }

    if (!canEditOrder.value) return;

    isDraggable.value = true;
}

function toggleOverlay(id: number) {
    if (opened.value.has(id)) {
        opened.value.delete(id);
    } else {
        opened.value.add(id);
    }
}

function handleCardClick(id: number) {
    if (isDraggable.value) return;
    if (id === 0) return;
    toggleOverlay(id);
}

function resolveOverlayStatus(overlay: Overlay): OverlayStatus {
    if (!overlay.healthy()) {
        return {
            label: 'Issue',
            variant: 'danger',
            tooltip: overlay._error?.message ?? 'Unknown error'
        };
    }

    if (overlay.loading) {
        return {
            label: 'Pending',
            variant: 'warning',
            tooltip: 'Overlay is still loading data from the server.'
        };
    }

    if (!overlay.styles?.length) {
        return {
            label: 'Pending',
            variant: 'warning',
            tooltip: 'Overlay does not contain any styles yet.'
        };
    }

    return {
        label: 'Ready',
        variant: 'success'
    };
}

function getOverlayBadges(overlay: Overlay): OverlayBadge[] {
    const badges: OverlayBadge[] = [];
    const seen = new Set<string>();

    const addBadge = (badge: OverlayBadge) => {
        if (seen.has(badge.label)) return;
        seen.add(badge.label);
        badges.push(badge);
    };

    if (overlay.mode === 'mission') {
        addBadge({ label: 'Mission', variant: 'primary' });
    } else if (overlay.mode === 'data') {
        addBadge({ label: 'Data', variant: 'info' });
    } else if (overlay.mode === 'profile') {
        addBadge({ label: 'Profile', variant: 'info' });
    }

    if (overlay.type === 'raster') {
        addBadge({ label: 'Raster', variant: 'secondary' });
    } else if (overlay.type === 'raster-dem') {
        addBadge({ label: 'Terrain', variant: 'secondary' });
    } else if (overlay.type === 'vector') {
        addBadge({ label: 'Vector', variant: 'secondary' });
    } else if (overlay.type === 'geojson') {
        addBadge({ label: 'GeoJSON', variant: 'secondary' });
    }

    if (!overlay.visible) {
        addBadge({ label: 'Hidden', variant: 'dark' });
    }

    return badges;
}

async function saveOrder(sortableEv: SortableEvent) {
    if (!sortable) return;
    if (sortableEv.newIndex === undefined || isNaN(parseInt(String(sortableEv.newIndex)))) return;

    const id = sortableEv.item.getAttribute('id');
    if (!id) return;

    const overlay_ids = sortable.toArray().map((i) => parseInt(i));

    await OverlayManager.reorderLoaded(overlay_ids, id);
}

async function updateOverlay(overlay: Overlay, body: OverlayUpdate): Promise<void> {
    const update = overlay.update(body);
    overlayRenderTick.value += 1;

    try {
        await update;
    } finally {
        overlayRenderTick.value += 1;
    }
}

async function removeOverlay(id: number) {
    loading.value = true;
    try {
        await OverlayManager.deleteLoaded(id);
    } finally {
        loading.value = false;
    }
}
</script>

