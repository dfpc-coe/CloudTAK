<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Terrain Profile'
        >
            <template #icon>
                <IconChartLine
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerBadge
                    v-if='sampleCount'
                    class='me-2'
                    background-color='rgba(59, 130, 246, 0.15)'
                    border-color='rgba(59, 130, 246, 0.4)'
                    text-color='#3b82f6'
                >
                    {{ sampleCount }} samples
                </TablerBadge>
            </template>

            <div class='overflow-hidden mb-2'>
                <div class='cloudtak-accent rounded mx-2 mt-2 px-2 py-2'>
                    <TablerLoading
                        v-if='loading'
                        desc='Loading terrain profile'
                    />

                    <div
                        v-else-if='error'
                        class='px-1 py-1 text-danger'
                    >
                        {{ error }}
                    </div>

                    <div
                        v-else-if='!stats'
                        class='px-1 py-1 text-muted'
                    >
                        No terrain samples are available for this line.
                    </div>

                    <template v-else>
                        <div class='row g-2'>
                            <div class='col-sm-6 col-xl-3'>
                                <div class='profile-stat rounded px-2 py-2'>
                                    <div class='subheader'>Distance</div>
                                    <div class='fw-semibold'>{{ formatDistance(stats.distanceKm) }}</div>
                                </div>
                            </div>
                            <div class='col-sm-6 col-xl-3'>
                                <div class='profile-stat rounded px-2 py-2'>
                                    <div class='subheader'>Min / Max</div>
                                    <div class='fw-semibold'>{{ formatElevation(stats.minElevation) }} / {{ formatElevation(stats.maxElevation) }}</div>
                                </div>
                            </div>
                            <div class='col-sm-6 col-xl-3'>
                                <div class='profile-stat rounded px-2 py-2'>
                                    <div class='subheader'>Gain</div>
                                    <div class='fw-semibold text-success'>{{ formatElevation(stats.gain) }}</div>
                                </div>
                            </div>
                            <div class='col-sm-6 col-xl-3'>
                                <div class='profile-stat rounded px-2 py-2'>
                                    <div class='subheader'>Loss</div>
                                    <div class='fw-semibold text-danger'>{{ formatElevation(stats.loss) }}</div>
                                </div>
                            </div>
                        </div>

                        <div class='small text-muted px-1 pt-2'>
                            Sampling every {{ formatDistance(sampleRateKm) }} from the enabled 3D terrain basemap.
                        </div>

                        <div class='profile-chart-shell mt-2'>
                            <canvas ref='canvasRef' />
                        </div>
                    </template>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { PropType } from 'vue';
import type { LineString } from 'geojson';
import { length } from '@turf/length';
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js';
import Chart from 'chart.js/auto';
import { IconChartLine } from '@tabler/icons-vue';
import { TablerBadge, TablerLoading } from '@tak-ps/vue-tabler';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import { server, std, stdurl } from '../../../std.ts';

type ElevationSample = {
    distance: number;
    coordinate: [number, number];
    elevation: number | null;
};

type ElevationProfile = {
    tileurl: string;
    zoom: number;
    encoding: 'mapbox' | 'terrarium';
    distance: number;
    stepDistance: number;
    sampledDistances: number[];
    tileCount: number;
    samples: ElevationSample[];
};

const props = defineProps({
    geometry: {
        type: Object as PropType<LineString>,
        required: true
    },
    terrainBasemapId: {
        type: Number,
        required: true
    },
    distanceUnit: {
        type: String,
        default: 'mile'
    },
    elevationUnit: {
        type: String,
        default: 'feet'
    }
});

const expanded = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const profile = ref<ElevationProfile | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const tilesURL = ref<string | null>(null);
const loadedSignature = ref<string | null>(null);

let chart: Chart<'line'> | null = null;

const geometryKey = computed(() => JSON.stringify(props.geometry.coordinates));
const lineDistanceKm = computed(() => {
    return length({
        type: 'Feature',
        properties: {},
        geometry: props.geometry
    });
});

const sampleRateKm = computed(() => {
    const target = lineDistanceKm.value / 64;
    return Math.min(0.25, Math.max(0.025, Number.isFinite(target) && target > 0 ? target : 0.025));
});

const samples = computed(() => {
    return (profile.value?.samples || []).filter((sample): sample is ElevationSample & { elevation: number } => {
        return sample.elevation !== null;
    });
});

const sampleCount = computed(() => samples.value.length);

const stats = computed(() => {
    if (!samples.value.length) return null;

    let minElevation = Number.POSITIVE_INFINITY;
    let maxElevation = Number.NEGATIVE_INFINITY;
    let gain = 0;
    let loss = 0;

    for (let i = 0; i < samples.value.length; i++) {
        const elevation = samples.value[i].elevation;
        minElevation = Math.min(minElevation, elevation);
        maxElevation = Math.max(maxElevation, elevation);

        if (i === 0) continue;

        const delta = elevation - samples.value[i - 1].elevation;
        if (delta > 0) gain += delta;
        else loss += Math.abs(delta);
    }

    return {
        distanceKm: profile.value?.distance || lineDistanceKm.value,
        minElevation,
        maxElevation,
        gain,
        loss,
    };
});

watch(() => [expanded.value, props.terrainBasemapId, geometryKey.value], async ([isExpanded]) => {
    if (!isExpanded) return;
    await loadProfile();
});

watch([samples, () => props.distanceUnit, () => props.elevationUnit], async () => {
    if (!expanded.value) return;
    await nextTick();
    renderChart();
});

onBeforeUnmount(() => {
    destroyChart();
});

async function getTilesURL(): Promise<string> {
    if (tilesURL.value) return tilesURL.value;

    const { data, error: configError } = await server.GET('/api/config/tiles');
    if (configError) throw new Error(configError.message || 'Failed to load tile configuration');
    if (!data?.url) throw new Error('Tile configuration did not include a PMTiles URL');

    tilesURL.value = data.url;
    return tilesURL.value;
}

async function loadProfile(): Promise<void> {
    const signature = `${props.terrainBasemapId}:${geometryKey.value}`;
    if (loadedSignature.value === signature && profile.value) {
        await nextTick();
        renderChart();
        return;
    }

    loading.value = true;
    error.value = null;

    try {
        const baseURL = await getTilesURL();
        const url = stdurl(new URL(baseURL + `/tiles/basemap/${props.terrainBasemapId}/elevation`));
        url.searchParams.set('token', localStorage.token);

        profile.value = await std(url, {
            method: 'POST',
            body: {
                geometry: props.geometry,
                sampleRate: sampleRateKm.value,
            }
        }) as ElevationProfile;

        loadedSignature.value = signature;
        await nextTick();
        renderChart();
    } catch (err) {
        destroyChart();
        error.value = err instanceof Error ? err.message : String(err);
        profile.value = null;
    } finally {
        loading.value = false;
    }
}

function destroyChart(): void {
    if (chart) {
        chart.destroy();
        chart = null;
    }
}

function renderChart(): void {
    if (!canvasRef.value || !samples.value.length) {
        destroyChart();
        return;
    }

    const data: ChartData<'line'> = {
        datasets: [{
            label: 'Elevation',
            data: samples.value.map((sample) => {
                return {
                    x: convertDistance(sample.distance),
                    y: convertElevation(sample.elevation)
                };
            }),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
            tension: 0.2,
        }]
    };

    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label(context: TooltipItem<'line'>) {
                        return `Elevation: ${formatElevation(Number(context.parsed.y))}`;
                    },
                    title(items: TooltipItem<'line'>[]) {
                        if (!items.length) return '';
                        return `Distance: ${formatDistanceFromDisplay(Number(items[0].parsed.x))}`;
                    }
                }
            }
        },
        scales: {
            x: {
                type: 'linear',
                title: {
                    display: true,
                    text: `Distance (${distanceUnitLabel()})`
                },
                ticks: {
                    callback(value) {
                        return formatAxisValue(Number(value));
                    }
                }
            },
            y: {
                title: {
                    display: true,
                    text: `Elevation (${elevationUnitLabel()})`
                },
                ticks: {
                    callback(value) {
                        return formatAxisValue(Number(value));
                    }
                }
            }
        }
    };

    destroyChart();
    chart = new Chart(canvasRef.value, {
        type: 'line',
        data,
        options
    });
}

function convertDistance(kilometers: number): number {
    switch (props.distanceUnit) {
        case 'meter': return kilometers * 1000;
        case 'kilometer': return kilometers;
        case 'mile': return kilometers * 0.621371;
        default: return kilometers;
    }
}

function convertElevation(meters: number): number {
    switch (props.elevationUnit) {
        case 'feet': return meters * 3.28084;
        case 'meter': return meters;
        default: return meters;
    }
}

function distanceUnitLabel(): string {
    switch (props.distanceUnit) {
        case 'meter': return 'm';
        case 'kilometer': return 'km';
        case 'mile': return 'mi';
        default: return props.distanceUnit;
    }
}

function elevationUnitLabel(): string {
    switch (props.elevationUnit) {
        case 'feet': return 'ft';
        case 'meter': return 'm';
        default: return props.elevationUnit;
    }
}

function formatAxisValue(value: number): string {
    if (!Number.isFinite(value)) return '';
    return value >= 100 ? Math.round(value).toString() : value.toFixed(1);
}

function formatDistance(kilometers: number): string {
    return `${formatNumber(convertDistance(kilometers))} ${distanceUnitLabel()}`;
}

function formatDistanceFromDisplay(value: number): string {
    return `${formatNumber(value)} ${distanceUnitLabel()}`;
}

function formatElevation(meters: number): string {
    return `${formatNumber(convertElevation(meters))} ${elevationUnitLabel()}`;
}

function formatNumber(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return value >= 100 ? Math.round(value).toLocaleString() : value.toFixed(1);
}
</script>

<style scoped>
.profile-chart-shell {
    position: relative;
    min-height: 260px;
}

.profile-stat {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
}

:global(html[data-bs-theme='light'] .profile-stat) {
    background: rgba(15, 23, 42, 0.03);
    border-color: rgba(15, 23, 42, 0.08);
}
</style>