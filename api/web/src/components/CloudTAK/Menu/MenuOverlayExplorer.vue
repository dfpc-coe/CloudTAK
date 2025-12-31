<template>
    <MenuTemplate name='Overlay Explorer'>
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div class='menu-overlay-explorer menu-overlays d-flex flex-column gap-3'>
                <div class='menu-overlays__controls mx-2 mt-2 d-flex align-items-center gap-3 flex-wrap'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Search overlays...'
                        class='flex-grow-1'
                    />
                </div>

                <TablerLoading v-if='loading' />
                <template v-else>
                    <StandardItem
                        class='menu-overlay-explorer__card menu-overlay-explorer__card--files mx-2 p-3'
                        @click='goToFiles'
                    >
                        <div class='menu-overlays__card-main d-flex justify-content-between gap-3'>
                            <div class='menu-overlays__card-info d-flex align-items-center gap-2 flex-grow-1'>
                                <IconUser
                                    class='menu-overlays__type-icon'
                                    :size='24'
                                    stroke='1'
                                />
                                <div class='menu-overlays__title-block flex-grow-1'>
                                    <div class='menu-overlays__title-row d-flex align-items-center gap-2'>
                                        <span class='menu-overlays__name fw-semibold'>Your Files</span>
                                        <span class='menu-overlays__status menu-overlays__status--success d-inline-flex align-items-center gap-1 rounded-pill px-2 py-1 small'>
                                            <span class='menu-overlays__status-dot' />
                                            Local
                                        </span>
                                    </div>
                                    <p class='menu-overlay-explorer__description mb-0 small'>
                                        Access overlays you have uploaded
                                    </p>
                                </div>
                            </div>
                            <div class='menu-overlays__card-actions d-flex align-items-center gap-2 flex-wrap'>
                                <TablerIconButton
                                    title='Open Files'
                                    @click.stop.prevent='goToFiles'
                                >
                                    <IconFolder
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>
                    </StandardItem>

                    <div
                        v-if='explorerCards.length'
                        class='menu-overlays__list mx-2 d-flex flex-column'
                    >
                        <StandardItem
                            v-for='card in explorerCards'
                            :key='card.basemap.id'
                            :class='[
                                "menu-overlay-explorer__card",
                                card.exists || loading ? "opacity-50 pe-none" : "",
                                "p-3"
                            ]'
                            :hover='!card.exists && !loading'
                            :aria-disabled='loading || card.exists'
                            @click='handleExplorerSelect(card.basemap)'
                        >
                            <div class='menu-overlays__card-main d-flex justify-content-between gap-3'>
                                <div class='menu-overlays__card-info d-flex align-items-center gap-2 flex-grow-1'>
                                    <IconMap
                                        v-if='card.type === "raster"'
                                        class='menu-overlays__type-icon'
                                        :size='20'
                                        stroke='1'
                                    />
                                    <IconVector
                                        v-else-if='card.type === "vector"'
                                        class='menu-overlays__type-icon'
                                        :size='20'
                                        stroke='1'
                                    />
                                    <IconServer
                                        v-else
                                        class='menu-overlays__type-icon'
                                        :size='20'
                                        stroke='1'
                                    />

                                    <div class='menu-overlays__title-block flex-grow-1'>
                                        <div class='menu-overlays__title-row d-flex align-items-center gap-2'>
                                            <span
                                                class='menu-overlays__name fw-semibold flex-grow-1'
                                                v-text='card.basemap.name'
                                            />
                                            <span
                                                class='menu-overlays__status d-inline-flex align-items-center gap-1 rounded-pill px-2 py-1 small'
                                                :class='`menu-overlays__status--${card.status.tone}`'
                                            >
                                                <span class='menu-overlays__status-dot' />
                                                {{ card.status.label }}
                                            </span>
                                        </div>

                                        <div
                                            v-if='card.badges.length'
                                            class='menu-overlays__badges d-flex flex-wrap gap-2 mt-2'
                                        >
                                            <span
                                                v-for='badge in card.badges'
                                                :key='`${card.basemap.id}-${badge.label}`'
                                                class='menu-overlays__badge'
                                                :class='`menu-overlays__badge--${badge.tone}`'
                                            >
                                                {{ badge.label }}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div class='menu-overlays__card-actions d-flex align-items-center gap-2 flex-wrap'>
                                    <TablerIconButton
                                        :title='card.exists ? "Overlay already added" : "Add Overlay"'
                                        :disabled='loading || card.exists'
                                        @click.stop.prevent='handleExplorerSelect(card.basemap)'
                                    >
                                        <IconPlus
                                            :size='20'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </div>
                            </div>
                        </StandardItem>
                    </div>

                    <TablerNone
                        v-else
                        label='No Overlays'
                        :create='false'
                        class='px-2'
                    />
                </template>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { Basemap, BasemapList } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerRefreshButton,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconUser,
    IconMap,
    IconVector,
    IconServer,
    IconPlus,
    IconFolder
} from '@tabler/icons-vue';
import StandardItem from '../util/StandardItem.vue';
import Overlay from '../../../base/overlay.ts';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();
const router = useRouter();

const loading = ref(false);

const paging = ref({
    filter: '',
    limit: 30,
    page: 0
});

const list = ref<BasemapList>({
    total: 0,
    collections: [],
    items: []
});
type ExplorerBadgeTone = 'primary' | 'neutral' | 'muted';
type ExplorerBadge = { label: string; tone: ExplorerBadgeTone };
type ExplorerStatusTone = 'success' | 'warning';
type ExplorerStatus = { label: string; tone: ExplorerStatusTone };
type ExplorerType = 'raster' | 'vector' | 'other';
type ExplorerCard = { basemap: Basemap; status: ExplorerStatus; badges: ExplorerBadge[]; type: ExplorerType; exists: boolean };

const overlayBasemapIds = computed<Set<string>>(() => {
    return new Set(
        mapStore.overlays
            .filter((overlay) => overlay.mode === 'overlay' && overlay.mode_id)
            .map((overlay) => String(overlay.mode_id))
    );
});

const explorerCards = computed<ExplorerCard[]>(() => list.value.items.map((basemap) => ({
    basemap,
    status: resolveExplorerStatus(basemap),
    badges: getExplorerBadges(basemap),
    type: resolveExplorerType(basemap.type),
    exists: overlayBasemapIds.value.has(String(basemap.id))
})));

watch(
    () => [paging.value.filter, paging.value.limit, paging.value.page],
    async () => {
        await fetchList();
    }
);

onMounted(async () => {
    await fetchList();
});

function basemapExists(basemap: Basemap): boolean {
    return overlayBasemapIds.value.has(String(basemap.id));
}

async function handleExplorerSelect(basemap: Basemap) {
    if (loading.value) return;
    if (basemapExists(basemap)) return;
    await createOverlay(basemap);
}

function goToFiles() {
    router.push('/menu/files');
}

function resolveExplorerStatus(basemap: Basemap): ExplorerStatus {
    if (basemap.username) {
        return {
            label: 'Private',
            tone: 'warning'
        };
    }

    return {
        label: 'Public',
        tone: 'success'
    };
}

function resolveExplorerType(type?: string | null): ExplorerType {
    const normalized = (type ?? '').toLowerCase();
    if (normalized === 'raster') return 'raster';
    if (normalized === 'vector') return 'vector';
    return 'other';
}

function getExplorerBadges(basemap: Basemap): ExplorerBadge[] {
    const badges: ExplorerBadge[] = [];
    const seen = new Set<string>();

    const addBadge = (badge: ExplorerBadge) => {
        if (seen.has(badge.label)) return;
        seen.add(badge.label);
        badges.push(badge);
    };

    if (basemap.type) {
        addBadge({
            label: formatLabel(basemap.type),
            tone: 'neutral'
        });
    }

    if (basemap.frequency) {
        addBadge({
            label: formatLabel(basemap.frequency),
            tone: 'primary'
        });
    }

    if (basemap.username) {
        addBadge({
            label: basemap.username,
            tone: 'muted'
        });
    }

    return badges;
}

function formatLabel(value?: string | number | null) {
    if (value === undefined || value === null) return '';
    return String(value)
        .split(/[_-]/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

async function createOverlay(overlay: Basemap) {
    loading.value = true;

    try {
        const createdOverlay = await Overlay.create({
            url: String(stdurl(`/api/basemap/${overlay.id}/tiles`)),
            name: overlay.name,
            mode: 'overlay',
            mode_id: String(overlay.id),
            frequency: overlay.frequency,
            type: overlay.type,
            styles: overlay.styles
        });

        (mapStore.overlays as unknown as Overlay[]).push(createdOverlay);

        router.push('/menu/overlays');
    } finally {
        loading.value = false;
    }
}

async function fetchList() {
    loading.value = true;

    try {
        const url = stdurl('/api/basemap');
        if (paging.value.filter) url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('overlay', 'true');
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('page', String(paging.value.page));
        list.value = await std(url) as BasemapList;
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.menu-overlay-explorer {
    min-height: 100%;
}

.menu-overlays__list {
    gap: 0.75rem;
}

.menu-overlays__card-main {
    width: 100%;
}

.menu-overlays__card-info {
    min-width: 0;
}

.menu-overlays__type-icon {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.85);
}

.menu-overlays__title-block {
    min-width: 0;
}

.menu-overlays__name {
    min-width: 0;
}

.menu-overlays__status {
    white-space: nowrap;
}

.menu-overlays__status--success {
    background-color: rgba(47, 179, 68, 0.2);
    color: #2fb344;
}

.menu-overlays__status--warning {
    background-color: rgba(247, 161, 0, 0.2);
    color: #f7a100;
}

.menu-overlays__status--danger {
    background-color: rgba(214, 57, 57, 0.25);
    color: #d63939;
}

.menu-overlays__status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: currentColor;
}

.menu-overlays__badge {
    font-size: 0.75rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.3);
}

.menu-overlays__badge--primary {
    border-color: rgba(36, 163, 255, 0.9);
    background-color: rgba(36, 163, 255, 0.2);
}

.menu-overlays__badge--neutral {
    border-color: rgba(255, 255, 255, 0.35);
    background-color: rgba(255, 255, 255, 0.1);
}

.menu-overlays__badge--muted {
    border-color: rgba(120, 120, 120, 0.8);
    background-color: rgba(120, 120, 120, 0.2);
}

.menu-overlay-explorer__card--files {
    background-color: rgba(36, 163, 255, 0.12);
    border-color: rgba(36, 163, 255, 0.5);
}

.menu-overlay-explorer__description {
    color: rgba(255, 255, 255, 0.7);
}

</style>
