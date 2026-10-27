<template>
    <MenuTemplate name='History'>
        <template #buttons>
            <TablerIconButton
                v-if='entries.length'
                title='Clear All Trails'
                @click='clearAll'
            >
                <IconTrash
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <template #default>
            <div class='col-12 pt-2'>
                <div class='d-flex align-items-center pb-1'>
                    <IconHistory
                        :size='18'
                        stroke='1'
                        class='me-2 text-muted'
                    />
                    <span class='text-body'>Load History</span>
                </div>
                <div class='text-muted small pb-2'>
                    Every CoT reported to the server within the window, drawn as points you can hover and open.
                </div>

                <div class='row g-2 align-items-end'>
                    <div class='col-12 col-sm-6'>
                        <TablerEnum
                            v-model='query.relative'
                            label='Window'
                            :options='["1 Hour", "4 Hours", "8 Hours", "24 Hours"]'
                        />
                    </div>
                    <div class='col-12 col-sm-6'>
                        <TablerToggle
                            v-model='query.bbox'
                            label='Current map view only'
                            class='mb-0'
                        />
                    </div>
                </div>

                <TablerLoading
                    v-if='loading'
                    desc='Loading history…'
                    :inline='true'
                />
                <TablerButton
                    v-else
                    class='btn-primary w-100 mt-2'
                    @click='loadAll'
                >
                    Load
                </TablerButton>

                <div
                    v-if='error'
                    class='small text-danger pt-2'
                    v-text='error'
                />
                <div
                    v-else-if='loaded !== null'
                    class='small text-muted pt-2'
                    v-text='loaded ? `Loaded ${loaded} points` : "No history in that window"'
                />
            </div>

            <div class='dropdown-divider my-2' />

            <TablerNone
                v-if='entries.length === 0'
                label='No Breadcrumb Trails'
                :create='false'
            />
            <template v-else>
                <div class='col-12 pb-2'>
                    <TablerInput
                        v-model='filter'
                        icon='search'
                        placeholder='Filter trails…'
                    />
                </div>
                <div class='col-12 pb-1'>
                    <span class='text-muted small'>
                        {{ filtered.length }} of {{ entries.length }} trails · {{ totalPoints }} points
                    </span>
                </div>
                <div class='d-flex flex-column gap-2 py-2'>
                    <StandardItem
                        v-for='entry in filtered'
                        :key='entry.uid'
                        class='d-flex align-items-center px-3 py-2 gap-3 cursor-pointer'
                        @click='flyToEntry(entry)'
                    >
                        <IconRoute
                            :size='20'
                            stroke='1'
                            class='flex-shrink-0'
                            :style='{ color: entry.color || "#ff0000" }'
                        />

                        <div class='flex-grow-1 d-flex flex-column gap-1 overflow-hidden'>
                            <span
                                class='fw-semibold text-truncate'
                                v-text='entry.callsign'
                            />
                            <div class='d-flex align-items-center gap-2'>
                                <span
                                    class='text-muted small text-truncate'
                                    v-text='entry.span ? spanLabel(entry.span) : entry.uid'
                                />
                                <TablerBadge
                                    class='small flex-shrink-0'
                                    background-color='rgba(107, 114, 128, 0.15)'
                                    border-color='rgba(107, 114, 128, 0.3)'
                                    text-color='#6b7280'
                                >
                                    {{ `${entry.points} pts` }}
                                </TablerBadge>
                            </div>
                        </div>

                        <div
                            class='d-flex align-items-center gap-2 flex-shrink-0'
                            @click.stop
                        >
                            <TablerToggle
                                :model-value='entry.live'
                                title='Live Trail'
                                @update:model-value='(val: boolean) => toggleLive(entry.uid, val)'
                            />

                            <TablerIconButton
                                title='View CoT'
                                @click.stop.prevent='router.push(`/cot/${entry.uid}`)'
                            >
                                <IconListDetails
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>

                            <TablerIconButton
                                title='Clear Trail'
                                @click.stop.prevent='clearTrail(entry)'
                            >
                                <IconTrash
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </StandardItem>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
    IconRoute,
    IconHistory,
    IconListDetails,
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerBadge,
    TablerEnum,
    TablerInput,
    TablerButton,
    TablerLoading,
    TablerNone,
    TablerToggle,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import { db, liveQuery } from '../../../database.ts';
import FeatureHistory, { type FeatureHistory_Span } from '../../../base/feature-history.ts';
import { useMapStore } from '../../../stores/map.ts';
import { server } from '../../../std.ts';
import type { InputFeature } from '../../../types.ts';

type TrailEntry = {
    uid: string;
    callsign: string;
    color?: string;
    live: boolean;
    points: number;
    span: FeatureHistory_Span | null;
};

const mapStore = useMapStore();
const router = useRouter();

const entries = ref<TrailEntry[]>([]);
const filter = ref('');

const query = ref({
    relative: '1 Hour',
    bbox: false,
});
const loading = ref(false);
const loaded = ref<number | null>(null);
const error = ref<string | null>(null);

const filtered = computed(() => {
    const needle = filter.value.trim().toLowerCase();
    if (!needle) return entries.value;

    return entries.value.filter((entry) => {
        return entry.callsign.toLowerCase().includes(needle) || entry.uid.toLowerCase().includes(needle);
    });
});

const totalPoints = computed(() => entries.value.reduce((sum, entry) => sum + entry.points, 0));

const subscription = liveQuery(async () => {
    const [trails, spans] = await Promise.all([
        db.breadcrumb.toArray(),
        FeatureHistory.spans(),
    ]);

    return trails.map((trail): TrailEntry => {
        const span = spans.get(trail.uid) || null;

        return {
            uid: trail.uid,
            callsign: trail.callsign,
            color: trail.color,
            live: trail.live,
            points: span ? span.count : (trail.coordinates ? trail.coordinates.length : 0),
            span,
        };
    }).sort((a, b) => (b.span?.last ?? 0) - (a.span?.last ?? 0) || a.callsign.localeCompare(b.callsign));
}).subscribe({
    next: (rows) => {
        entries.value = rows;
    },
    error: (err: unknown) => {
        console.error('History menu subscription failed', err);
    },
});

onUnmounted(() => {
    subscription.unsubscribe();
});

function spanLabel(span: FeatureHistory_Span): string {
    const first = new Date(span.first);
    const last = new Date(span.last);
    const time = (date: Date) => date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    if (first.toDateString() === last.toDateString()) {
        return `${first.toLocaleDateString()} ${time(first)} – ${time(last)}`;
    }

    return `${first.toLocaleString()} – ${last.toLocaleString()}`;
}

async function loadAll(): Promise<void> {
    loading.value = true;
    loaded.value = null;
    error.value = null;

    try {
        const secago = 60 * 60 * Number(query.value.relative.split(' ')[0]);

        let bbox: string | undefined;
        if (query.value.bbox) {
            const bounds = mapStore.map.getBounds();
            bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(',');
        }

        const { data, error: err } = await server.GET('/api/marti/cot', {
            params: {
                query: { secago, bbox, filtered: true }
            }
        });
        if (err || !data) throw new Error(String(err || 'No data'));

        loaded.value = await mapStore.worker.db.breadcrumb.ingest(data.features as unknown as InputFeature[]);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        loading.value = false;
    }
}

async function flyToEntry(entry: TrailEntry): Promise<void> {
    if (await mapStore.history.flyTo(entry.uid)) return;

    const cot = await mapStore.worker.db.get(entry.uid, { mission: true });
    if (cot) await cot.flyTo();
}

async function toggleLive(uid: string, enabled: boolean): Promise<void> {
    await mapStore.worker.db.breadcrumb.set(uid, enabled);
}

async function clearTrail(entry: TrailEntry): Promise<void> {
    await mapStore.worker.db.breadcrumb.remove(entry.uid);
}

async function clearAll(): Promise<void> {
    for (const entry of entries.value) {
        await mapStore.worker.db.breadcrumb.remove(entry.uid);
    }
    await mapStore.worker.db.breadcrumb.clearAll();
    loaded.value = null;
}
</script>
