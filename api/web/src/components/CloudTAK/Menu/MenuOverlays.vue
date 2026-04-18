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
                <div class='menu-overlays__controls mt-2 d-flex align-items-center gap-3 flex-wrap'>
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
                        class='menu-overlays__list d-flex flex-column gap-3'
                    >
                        <StandardItem
                            v-for='card in overlayCards'
                            :id='String(card.overlay.id)'
                            :key='card.overlay.id'
                            class='menu-overlays__card p-3'
                            :class='{
                                "menu-overlays__card--dragging": isDraggable
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
                                            <div class='d-flex align-items-center flex-grow-1 w-100'>
                                                <a
                                                    v-if='card.overlay.mode === "mission"'
                                                    class='menu-overlays__name menu-overlays__name--link fw-semibold text-decoration-underline d-inline-flex align-items-center text-break'
                                                    @click.stop='router.push(`/menu/missions/${card.overlay.mode_id}`)'
                                                    v-text='card.overlay.name'
                                                />
                                                <span
                                                    v-else
                                                    class='menu-overlays__name fw-semibold d-inline-flex align-items-center flex-grow-1 text-break'
                                                    v-text='card.overlay.name'
                                                />
                                            </div>
                                        </div>
                                        <div
                                            v-if='card.badges.length'
                                            class='menu-overlays__badges d-flex flex-wrap gap-2 mt-2'
                                        >
                                            <TablerBadge
                                                v-for='badge in card.badges'
                                                :key='`${card.overlay.id}-${badge.label}`'
                                                class='rounded-pill small'
                                                :background-color='badgeToneColors[badge.tone].bg'
                                                :border-color='badgeToneColors[badge.tone].border'
                                                :text-color='badgeToneColors[badge.tone].text'
                                            >
                                                {{ badge.label }}
                                            </TablerBadge>
                                        </div>
                                    </div>
                                </div>

                                <div
                                    style='min-width: 100px;'
                                    class='d-flex flex-column align-items-end gap-2'
                                >
                                    <TablerBadge
                                        class='rounded-pill small d-inline-flex align-items-center gap-1 px-2 py-1'
                                        :background-color='statusToneColors[card.status.tone].bg'
                                        :border-color='statusToneColors[card.status.tone].border'
                                        :text-color='statusToneColors[card.status.tone].text'
                                        :title='card.status.tooltip || ""'
                                    >
                                        {{ card.status.label }}
                                    </TablerBadge>

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
import { ref, watch, useTemplateRef, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerBadge,
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
import StandardItem from '../util/StandardItem.vue';
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

const statusToneColors: Record<OverlayStatusTone, { bg: string; border: string; text: string }> = {
    success: { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.5)', text: '#16a34a' },
    warning: { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 0.5)', text: '#d97706' },
    danger: { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.5)', text: '#dc2626' }
};

const badgeToneColors: Record<OverlayBadgeTone, { bg: string; border: string; text: string }> = {
    mission: { bg: 'rgba(59, 130, 246, 0.25)', border: 'rgba(59, 130, 246, 0.5)', text: '#2563eb' },
    primary: { bg: 'rgba(6, 182, 212, 0.2)', border: 'rgba(6, 182, 212, 0.5)', text: '#0891b2' },
    neutral: { bg: 'rgba(107, 114, 128, 0.2)', border: 'rgba(107, 114, 128, 0.5)', text: '#4b5563' },
    warning: { bg: 'rgba(245, 158, 11, 0.2)', border: 'rgba(245, 158, 11, 0.5)', text: '#d97706' },
    muted: { bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.3)', text: '#6b7280' }
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

    overlays.sort((a, b) => {
        return a.pos - b.pos;
    });
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
