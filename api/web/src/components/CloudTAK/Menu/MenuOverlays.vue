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
            <div class='menu-overlays d-flex flex-column gap-3'>
                <div class='menu-overlays__controls mt-2 d-flex mx-2 align-items-center gap-3 flex-wrap'>
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
                        class='menu-overlays__list d-flex flex-column gap-3 mx-2'
                    >
                        <article
                            v-for='card in overlayCards'
                            :id='String(card.overlay.id)'
                            :key='card.overlay.id'
                            class='menu-overlays__card border border-white border-opacity-25 rounded-4 bg-black bg-opacity-25 p-3 shadow-sm'
                            :class='{
                                "menu-overlays__card--dragging": isDraggable,
                                "cursor-pointer": !isDraggable && card.overlay.id !== 0
                            }'
                            @click='handleCardClick(card.overlay.id)'
                            @keydown.enter.prevent='handleCardKeydown(card.overlay.id)'
                            @keydown.space.prevent='handleCardKeydown(card.overlay.id)'
                        >
                            <div
                                class='d-flex justify-content-between gap-3'
                            >
                                <div
                                    class='d-flex align-items-center gap-2 flex-grow-1 w-100 overflow-hidden'
                                    role='button'
                                    :tabindex='!isDraggable && card.overlay.id !== 0 ? 0 : -1'
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
                                        <div class='menu-overlays__title-row d-flex align-items-center gap-2 w-100'>
                                            <div class='d-flex align-items-center flex-grow-1 w-100 overflow-hidden'>
                                                <a
                                                    v-if='card.overlay.mode === "mission"'
                                                    class='menu-overlays__name menu-overlays__name--link fw-semibold text-decoration-underline d-inline-flex align-items-center'
                                                    @click.stop='router.push(`/menu/missions/${card.overlay.mode_id}`)'
                                                    v-text='card.overlay.name'
                                                />
                                                <span
                                                    v-else
                                                    class='menu-overlays__name fw-semibold d-inline-flex align-items-center flex-grow-1 text-truncate'
                                                    v-text='card.overlay.name'
                                                />
                                            </div>
                                        </div>
                                        <div
                                            v-if='card.badges.length'
                                            class='menu-overlays__badges d-flex flex-wrap gap-2 mt-2'
                                        >
                                            <span
                                                v-for='badge in card.badges'
                                                :key='`${card.overlay.id}-${badge.label}`'
                                                class='badge rounded-pill small'
                                                :class='badgeToneClasses[badge.tone]'
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
                                        class='badge rounded-pill small d-inline-flex align-items-center gap-1 px-2 py-1'
                                        :class='statusToneClasses[card.status.tone]'
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
                                            v-if='card.overlay.visible'
                                            title='Hide Layer'
                                            @click.stop.prevent='card.overlay.update({ visible: !card.overlay.visible })'
                                        >
                                            <IconEye
                                                :size='20'
                                                stroke='1'
                                            />
                                        </TablerIconButton>

                                        <TablerIconButton
                                            v-else
                                            title='Show Layer'
                                            @click.stop.prevent='card.overlay.update({ visible: !card.overlay.visible })'
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

                            <transition name='menu-overlays-fade'>
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
                                            v-model='card.overlay.opacity'
                                            label='Opacity'
                                            :min='0'
                                            :max='1'
                                            :step='0.1'
                                            @change='card.overlay.update({
                                                opacity: card.overlay.opacity
                                            })'
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
                            </transition>
                        </article>
                    </div>

                    <TablerNone
                        v-else
                        label='overlays match your search'
                        :create='false'
                        class='px-2'
                    />
                </template>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, useTemplateRef, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerDelete,
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
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs';
import { useMapStore } from '../../../../src/stores/map.ts';
import type Overlay from '../../../../src/base/overlay.ts';

type OverlayBadgeTone = 'primary' | 'neutral' | 'mission' | 'warning' | 'muted';
type OverlayBadge = { label: string; tone: OverlayBadgeTone };
type OverlayStatusTone = 'success' | 'warning' | 'danger';
type OverlayStatus = { label: string; tone: OverlayStatusTone; tooltip?: string };
type OverlayCard = { overlay: Overlay; status: OverlayStatus; badges: OverlayBadge[] };

const mapStore = useMapStore();
const router = useRouter();

const statusToneClasses: Record<OverlayStatusTone, string> = {
    success: 'bg-success-subtle text-success-emphasis border border-success border-opacity-50',
    warning: 'bg-warning-subtle text-warning-emphasis border border-warning border-opacity-50',
    danger: 'bg-danger-subtle text-danger-emphasis border border-danger border-opacity-50'
};

const badgeToneClasses: Record<OverlayBadgeTone, string> = {
    mission: 'bg-primary text-white border border-primary border-opacity-50',
    primary: 'bg-info-subtle text-info-emphasis border border-info border-opacity-50',
    neutral: 'bg-light bg-opacity-10 text-light border border-light border-opacity-25',
    warning: 'bg-warning-subtle text-warning-emphasis border border-warning border-opacity-50',
    muted: 'bg-secondary-subtle text-secondary-emphasis border border-secondary border-opacity-50'
};

let sortable: Sortable | undefined;

const isDraggable = ref(false);
const loading = ref(false);
const opened = ref<Set<number>>(new Set());
const overlayFilter = ref('');

const isLoaded = mapStore.isLoaded;
const overlays = (mapStore as unknown as { overlays: Overlay[] }).overlays;

const sortableRef = useTemplateRef<HTMLElement>('sortableRef');

const hasSearchTerm = computed(() => overlayFilter.value.trim().length > 0);

const filteredOverlays = computed<Overlay[]>(() => {
    const term = overlayFilter.value.trim().toLowerCase();
    if (!term) return overlays;

    return overlays.filter((overlay) => {
        const name = (overlay.name ?? '').toLowerCase();
        const type = (overlay.type ?? '').toLowerCase();
        const mode = (overlay.mode ?? '').toLowerCase();

        return (
            name.includes(term)
            || type.includes(term)
            || mode.includes(term)
        );
    });
});

const overlayCards = computed<OverlayCard[]>(() => filteredOverlays.value.map((overlay) => ({
    overlay,
    status: resolveOverlayStatus(overlay),
    badges: getOverlayBadges(overlay)
})));

const canEditOrder = computed(() => !hasSearchTerm.value && overlays.length > 1);

const showDragHint = computed(() => overlays.length > 1 && !isDraggable.value && !canEditOrder.value);

const dragHintCopy = computed(() => {
    if (!showDragHint.value) return '';
    return 'Reordering available once you clear the search.';
});

const reorderButtonTitle = computed(() => {
    if (isDraggable.value) return 'Save Order';
    if (!canEditOrder.value) {
        if (overlays.length <= 1) return 'Add another overlay to reorder';
        return 'Clear the search to reorder overlays';
    }
    return 'Edit Order';
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

function handleCardKeydown(id: number) {
    handleCardClick(id);
}

function resolveOverlayStatus(overlay: Overlay): OverlayStatus {
    if (!overlay.healthy()) {
        return {
            label: 'Issue',
            tone: 'danger',
            tooltip: overlay._error?.message ?? 'Unknown error'
        };
    }

    if (!overlay.styles?.length) {
        return {
            label: 'Pending',
            tone: 'warning',
            tooltip: 'Overlay does not contain any styles yet.'
        };
    }

    return {
        label: 'Ready',
        tone: 'success'
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
        addBadge({ label: 'Mission', tone: 'mission' });
    } else if (overlay.mode === 'data') {
        addBadge({ label: 'Data', tone: 'primary' });
    } else if (overlay.mode === 'profile') {
        addBadge({ label: 'Profile', tone: 'primary' });
    }

    if (overlay.type === 'raster') {
        addBadge({ label: 'Raster', tone: 'neutral' });
    } else if (overlay.type === 'vector') {
        addBadge({ label: 'Vector', tone: 'neutral' });
    } else if (overlay.type === 'geojson') {
        addBadge({ label: 'GeoJSON', tone: 'neutral' });
    }

    if (!overlay.visible) {
        addBadge({ label: 'Hidden', tone: 'muted' });
    }

    return badges;
}

async function saveOrder(sortableEv: SortableEvent) {
    if (!sortable) return;
    if (sortableEv.newIndex === undefined || isNaN(parseInt(String(sortableEv.newIndex)))) return;

    const id = sortableEv.item.getAttribute('id');
    if (!id) return;

    const overlay_ids = sortable.toArray().map((i) => parseInt(i));

    const overlay = mapStore.getOverlayById(parseInt(id));
    if (!overlay) throw new Error('Could not find Overlay');

    const post = mapStore.getOverlayById(overlay_ids[sortableEv.newIndex + 1]);

    for (const l of overlay.styles) {
        if (post) {
            mapStore.map.moveLayer(l.id, post.styles[0].id);
        } else {
            mapStore.map.moveLayer(l.id);
        }
    }

    for (const current of overlays) {
        await current.update({
            pos: overlay_ids.indexOf(current.id)
        });
    }
}

async function removeOverlay(id: number) {
    loading.value = true;
    for (const overlay of overlays) {
        if (overlay.id === id) {
            await mapStore.removeOverlay(overlay);
        }
    }
    loading.value = false;
}
</script>

<style scoped>
.menu-overlays__card {
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.menu-overlays__card--dragging {
    border-color: rgba(99, 137, 255, 0.6) !important;
    box-shadow: 0 0 0 1px rgba(99, 137, 255, 0.5);
}

.menu-overlays__card:hover,
.menu-overlays__card:focus-within {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.4) !important;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}

.menu-overlays__name {
    min-width: 0;
    display: inline-flex;
    align-items: center;
}

.menu-overlays__name--link {
    width: fit-content;
}

.menu-overlays-fade-enter-active,
.menu-overlays-fade-leave-active {
    transition: opacity 0.15s ease;
}

.menu-overlays-fade-enter-from,
.menu-overlays-fade-leave-to {
    opacity: 0;
}
</style>
