<template>
    <MenuTemplate
        :scroll='false'
        :loading='loading'
    >
        <template
            v-if='device'
            #header
        >
            <div class='flex-shrink-0'>
                <FeatureIcon
                    :key='device.type'
                    :size='32'
                    :feature='iconFeature'
                />
            </div>
            <div
                class='flex-grow-1 mx-2'
                style='min-width: 0'
            >
                <CopyField
                    :model-value='device.name'
                    :edit='is_editable'
                    :minheight='44'
                    :hover='is_editable'
                    @submit='patch({ name: String($event) })'
                />
            </div>
        </template>

        <TablerAlert
            v-if='error'
            :err='error'
        />
        <TablerNone
            v-else-if='!device && !loading'
            :create='false'
            label='No Device'
        />
        <div
            v-else-if='device'
            :key='deviceKey'
            class='d-flex flex-column h-100'
            style='min-height: 0;'
        >
            <div class='entity-actions d-flex align-items-center flex-nowrap px-2 py-1 border-bottom cloudtak-header flex-shrink-0'>
                <TablerIconButton
                    v-if='device.geometry'
                    title='Zoom To'
                    @click='flyTo'
                >
                    <IconZoomPan
                        :size='actionIconSize'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    v-if='is_editable && device.geometry'
                    title='Move Marker'
                    @click='editGeometry'
                >
                    <IconPencil
                        :size='actionIconSize'
                        stroke='1'
                    />
                </TablerIconButton>

                <div class='ms-auto d-flex align-items-center flex-nowrap'>
                    <TablerDelete
                        v-if='is_creator'
                        displaytype='icon'
                        :size='actionIconSize'
                        @delete='deleteDevice'
                    />
                </div>
            </div>

            <div
                v-if='saveError'
                class='flex-shrink-0 px-2 pt-2'
            >
                <TablerInlineAlert
                    severity='danger'
                    title='Change Not Saved'
                    :description='saveError.message'
                />
            </div>

            <div
                class='overflow-auto overflow-x-hidden flex-grow-1'
                style='min-height: 0;'
            >
                <div class='pt-1'>
                    <div class='px-2 pb-2'>
                        <PropertyType
                            :key='device.id'
                            :edit='is_editable'
                            :model-value='device.type'
                            @update:model-value='patch({ type: String($event) })'
                        />
                    </div>

                    <PropertyFactRow
                        label='Coords'
                        class='py-1'
                    >
                        <Coordinate
                            v-if='device.geometry'
                            :key='deviceKey'
                            :inline='true'
                            :edit='is_editable'
                            :hover='is_editable'
                            :model-value='device.geometry.coordinates'
                            @update:model-value='updateCoordinates($event as number[])'
                        />
                        <span
                            v-else
                            class='text-muted fst-italic'
                        >No location reported</span>
                    </PropertyFactRow>

                    <!-- Status & Battery share one row when a battery level is reported -->
                    <PropertyFactRow
                        label='Status'
                        class='py-1'
                    >
                        <div class='row g-2'>
                            <div
                                class='d-flex align-items-center gap-2'
                                :class='device.battery !== null ? "col-6" : "col-12"'
                            >
                                <span
                                    title='Status'
                                    class='d-flex align-items-center gap-1 text-truncate'
                                >
                                    <IconHeartbeat
                                        :size='18'
                                        stroke='1'
                                        class='flex-shrink-0'
                                    />
                                    <span
                                        class='text-truncate'
                                        v-text='device.status || "Unknown"'
                                    />
                                </span>
                                <span
                                    v-if='device.simulated'
                                    title='Simulated data source'
                                    class='badge bg-yellow text-yellow-fg text-uppercase flex-shrink-0'
                                >Sim</span>
                            </div>
                            <div
                                v-if='device.battery !== null'
                                title='Battery'
                                class='col-6 d-flex align-items-center gap-1'
                            >
                                <PropertyBattery
                                    :battery='device.battery'
                                    :size='18'
                                />
                                <span v-text='`${device.battery}%`' />
                            </div>
                        </div>
                    </PropertyFactRow>

                    <PropertyFactRow
                        v-if='hardwareName'
                        label='Hardware'
                        class='py-1'
                    >
                        <div class='d-flex align-items-center gap-1'>
                            <IconBuildingFactory2
                                :size='18'
                                stroke='1'
                                class='flex-shrink-0'
                            />
                            <span
                                class='text-truncate user-select-all'
                                v-text='hardwareName'
                            />
                        </div>
                    </PropertyFactRow>

                    <!-- Serial & Firmware share one row when both are reported -->
                    <PropertyFactRow
                        v-if='device.serial || device.firmware'
                        :label='device.serial ? "Serial" : "Firmware"'
                        class='py-1'
                    >
                        <div class='row g-2'>
                            <div
                                v-if='device.serial'
                                title='Serial'
                                class='d-flex align-items-center gap-1'
                                :class='device.firmware ? "col-6" : "col-12"'
                            >
                                <IconBarcode
                                    :size='18'
                                    stroke='1'
                                    class='flex-shrink-0'
                                />
                                <span
                                    class='text-truncate user-select-all'
                                    v-text='device.serial'
                                />
                            </div>
                            <div
                                v-if='device.firmware'
                                title='Firmware'
                                class='d-flex align-items-center gap-1'
                                :class='device.serial ? "col-6" : "col-12"'
                            >
                                <IconVersions
                                    :size='18'
                                    stroke='1'
                                    class='flex-shrink-0'
                                />
                                <span
                                    class='text-truncate user-select-all'
                                    v-text='device.firmware'
                                />
                            </div>
                        </div>
                    </PropertyFactRow>

                    <PropertyFactRow
                        v-if='device.username'
                        label='Creator'
                    >
                        <a
                            :href='`mailto:${device.username}`'
                            class='text-reset d-block text-truncate'
                            v-text='device.username'
                        />
                    </PropertyFactRow>
                </div>

                <PropertyRemarks
                    :model-value='device.remarks'
                    :edit='is_editable'
                    @submit='patch({ remarks: $event })'
                />

                <PropertyTabs
                    v-model='tab'
                    :tabs='tabs'
                    class='mt-2'
                />

                <div v-show='tab === "details"'>
                    <PropertyCoreEntityLinks
                        :model-value='device.links'
                        :edit='is_editable'
                        @update:model-value='patch({ links: $event })'
                    />

                    <!-- PropertyStyle has no read-only mode so hide it for non-editors -->
                    <PropertyStyle
                        v-if='is_editable'
                        geometry='Point'
                        :model-value='styleProperties'
                        @update:model-value='updateStyle($event)'
                    />

                    <PropertyCoreEntityExternalId
                        :model-value='device.external_ids'
                        :edit='is_editable'
                        @update:model-value='patch({ external_id: $event })'
                    />

                    <PropertyCoreEntityMetadata
                        :model-value='device.metadata'
                        :edit='is_editable'
                        @update:model-value='patch({ metadata: $event })'
                    />
                </div>

                <div v-show='tab === "channels"'>
                    <PropertyCoreEntityChannels
                        :model-value='device.channels'
                        :edit='is_creator'
                        @update:model-value='patch({ channels: $event })'
                    />
                </div>
            </div>

            <PropertyCoreEntityTimes
                :created='device.created'
                :updated='device.updated'
                :username='device.username'
            />
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    TablerNone,
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconZoomPan,
    IconBarcode,
    IconVersions,
    IconHeartbeat,
    IconBuildingFactory2,
} from '@tabler/icons-vue';
import MenuTemplate from './util/MenuTemplate.vue';
import FeatureIcon from './util/FeatureIcon.vue';
import CopyField from './util/CopyField.vue';
import Coordinate from './util/Coordinate.vue';
import PropertyFactRow from './util/PropertyFactRow.vue';
import PropertyTabs, { type PropertyTab } from './util/PropertyTabs.vue';
import PropertyType from './Property/PropertyType.vue';
import PropertyStyle from './Property/PropertyStyle.vue';
import PropertyRemarks from './Property/PropertyRemarks.vue';
import PropertyBattery from './Property/PropertyBattery.vue';
import PropertyCoreEntityExternalId from './Property/PropertyCoreEntityExternalId.vue';
import PropertyCoreEntityLinks from './Property/PropertyCoreEntityLinks.vue';
import PropertyCoreEntityChannels from './Property/PropertyCoreEntityChannels.vue';
import PropertyCoreEntityMetadata from './Property/PropertyCoreEntityMetadata.vue';
import PropertyCoreEntityTimes from './Property/PropertyCoreEntityTimes.vue';
import type { CoreDevice, CoreEntityStyle } from '../../types.ts';
import { server } from '../../std.ts';
import { db, liveQuery } from '../../database.ts';
import { useMapStore } from '../../stores/map.ts';
import { useEntityAccess } from '../../utils/entity-access.ts';
import { entityMarkerProperties } from '../../utils/core-entity.ts';

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const deviceKey = computed(() => String(route.params.device || ''));
const actionIconSize = 28;

const device = ref<CoreDevice | undefined>();
const loading = ref(true);
const error = ref<Error | undefined>();

// A change the server rejected - kept apart from `error` so a failed save
// doesn't replace the Device with an error page
const saveError = ref<Error | undefined>();

const tab = ref('details');

const tabs: Array<PropertyTab> = [
    { value: 'details', label: 'Details' },
    { value: 'channels', label: 'Channels' },
];

// Hardware details come from the upstream source that reports the Device
// and are shown read-only
const hardwareName = computed(() => {
    if (!device.value) return '';

    return [device.value.manufacturer, device.value.model].filter(Boolean).join(' ');
});

const { is_creator, is_editable, load: loadAccess } = useEntityAccess(device);

// The header icon isn't a CoT - FeatureIcon derives the MIL-STD symbol from the
// type the same way it does for one
const iconFeature = computed(() => {
    if (!device.value) return { properties: {}, geometry: { type: 'Point' } };

    return {
        properties: {
            type: device.value.type,
            icon: device.value.style.icon,
            'marker-color': device.value.style['marker-color'],
        },
        geometry: device.value.geometry || { type: 'Point' },
    };
});

const styleProperties = computed(() => {
    if (!device.value) return {};

    // PropertyStyle falls back to the type when an icon is cleared
    return { ...device.value.style, type: device.value.type };
});

onMounted(async () => {
    await loadAccess();
    await fetchDevice();
    watchCot();
});

onBeforeUnmount(() => {
    unwatchCot();
});

watch(deviceKey, async () => {
    await fetchDevice();
    watchCot();
});

async function fetchDevice(): Promise<void> {
    if (!deviceKey.value) return;

    loading.value = true;
    error.value = undefined;

    try {
        device.value = await loadDevice();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

/** Reload server state in place - no loading flash, the current Device stays up on failure */
async function refreshDevice(): Promise<void> {
    if (!deviceKey.value) return;

    try {
        device.value = await loadDevice();
    } catch (err) {
        console.error('Failed to refresh Core Device', err);
    }
}

async function loadDevice(): Promise<CoreDevice> {
    const res = await server.GET('/api/core/device/{:device}', {
        params: {
            path: {
                ':device': deviceKey.value
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    // openapi-fetch widens the coordinate 2-tuple the API declares
    return res.data as CoreDevice;
}

/**
 * A new broadcast time on the locally stored Device marker means the Device
 * was updated elsewhere (ETL submit, another client) - refetch it
 */
let cotSubscription: { unsubscribe: () => void } | undefined;

function watchCot(): void {
    unwatchCot();

    if (!deviceKey.value) return;

    const id = deviceKey.value;
    let seeded = false;
    let lastTime: string | undefined;

    cotSubscription = liveQuery(() => db.feature.get(id)).subscribe((feat) => {
        const time = feat ? feat.properties.time : undefined;

        if (seeded && time !== lastTime) void refreshDevice();

        seeded = true;
        lastTime = time;
    });
}

function unwatchCot(): void {
    if (cotSubscription) cotSubscription.unsubscribe();
    cotSubscription = undefined;
}

// The PATCH response replaces local state so the view always renders
// server state rather than an optimistic local copy
async function patch(body: Record<string, unknown>): Promise<void> {
    if (!device.value) return;

    saveError.value = undefined;

    try {
        const res = await server.PATCH('/api/core/device/{:device}', {
            params: {
                path: {
                    ':device': device.value.id
                }
            },
            body
        });

        if (res.error) throw new Error(res.error.message);

        device.value = res.data as CoreDevice;

        await syncMapFeature();
    } catch (err) {
        // A rejected change must not take the whole view down with it - the
        // Device is reloaded so the UI stops showing a value the server refused
        await fetchDevice();

        saveError.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function syncMapFeature(): Promise<void> {
    if (!device.value || !mapStore._worker) return;

    try {
        const cot = await mapStore.worker.db.get(device.value.id);
        if (!cot) return;

        await cot.update({ properties: entityMarkerProperties(cot.properties, device.value) });
    } catch (err) {
        console.error(`Failed to sync Device ${device.value.id} to its map feature:`, err);
    }
}

function updateCoordinates(coordinates: number[]): void {
    void patch({
        geometry: {
            type: 'Point',
            coordinates: coordinates.slice(0, 2)
        }
    });
}

function updateStyle(properties: Record<string, unknown>): void {
    // PropertyStyle round trips the whole property object - only the keys the
    // Device style supports can be submitted back to the API
    const style: CoreEntityStyle = {};

    if (typeof properties.icon === 'string') style.icon = properties.icon;
    if (typeof properties['marker-color'] === 'string') style['marker-color'] = properties['marker-color'];

    if (properties['marker-opacity'] !== undefined && !isNaN(Number(properties['marker-opacity']))) {
        style['marker-opacity'] = Number(properties['marker-opacity']);
    }

    void patch({ style });
}

function flyTo(): void {
    if (!device.value || !device.value.geometry) return;

    mapStore.map.flyTo({
        center: [device.value.geometry.coordinates[0], device.value.geometry.coordinates[1]],
        zoom: Math.max(mapStore.map.getZoom(), 14),
    });
}

// The geometry change is synced back to the Device API by the Atlas Database
// when the edit finishes
async function editGeometry(): Promise<void> {
    if (!device.value) return;

    saveError.value = undefined;

    const cot = await mapStore.worker.db.get(device.value.id);

    if (!cot) {
        saveError.value = new Error('The Device marker is not currently on the map so its location cannot be edited here');
        return;
    }

    await mapStore.draw.edit(cot);
}

async function deleteDevice(): Promise<void> {
    if (!device.value) return;

    try {
        const res = await server.DELETE('/api/core/device/{:device}', {
            params: {
                path: {
                    ':device': device.value.id
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        // The Device is gone server side - drop its marker locally rather than
        // waiting for it to go stale on the map
        if (mapStore._worker) {
            try {
                await mapStore.worker.db.remove(device.value.id, { skipNetwork: true });
            } catch (err) {
                console.error(`Failed to remove deleted Device ${device.value.id} from the map:`, err);
            }
        }

        router.push('/');
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

<style scoped>
.entity-actions :deep(svg) {
    display: block;
}
</style>
