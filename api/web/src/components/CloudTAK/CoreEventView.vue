<template>
    <MenuTemplate
        :scroll='false'
        :loading='loading'
        :standalone='!embedded'
        :back='!embedded'
    >
        <template
            v-if='event'
            #header
        >
            <div class='flex-shrink-0'>
                <FeatureIcon
                    :key='event.type'
                    :size='32'
                    :feature='iconFeature'
                />
            </div>
            <div
                class='flex-grow-1 mx-2'
                style='min-width: 0'
            >
                <CopyField
                    :model-value='event.name'
                    :edit='is_editable'
                    :minheight='44'
                    :hover='is_editable'
                    @submit='patch({ name: String($event) })'
                />
            </div>
        </template>

        <template
            v-if='embedded'
            #buttons
        >
            <TablerIconButton
                title='Close'
                @click='emit("close")'
            >
                <IconCircleX
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <TablerAlert
            v-if='error'
            :err='error'
        />
        <TablerNone
            v-else-if='!event && !loading'
            :create='false'
            label='No Event'
        />
        <div
            v-else-if='event'
            :key='eventKey'
            class='d-flex flex-column h-100'
            style='min-height: 0;'
        >
            <div class='col-12 border-bottom cloudtak-bg flex-shrink-0 d-flex align-items-center flex-nowrap gap-0 px-1 py-1'>
                <div class='btn-list d-flex flex-nowrap align-items-center gap-0 mb-0'>
                    <TablerIconButton
                        v-if='hasMap'
                        title='Zoom To'
                        @click='flyTo'
                    >
                        <IconZoomPan
                            :size='actionIconSize'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        v-if='is_editable && hasMap'
                        title='Edit'
                        @click='editGeometry'
                    >
                        <IconPencil
                            :size='actionIconSize'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        v-if='event.links.length'
                        title='Open Primary Link'
                        @click='openLink(event.links[0].url)'
                    >
                        <IconExternalLink
                            :size='actionIconSize'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
                <div class='ms-auto btn-list d-flex flex-nowrap align-items-center gap-0 mb-0'>
                    <!-- Only the creator can change who is allowed to edit -->
                    <TablerIconButton
                        v-if='is_creator'
                        :title='event.editable ? "Disable Editing by Others" : "Allow Editing by Others"'
                        @click='patch({ editable: !event.editable })'
                    >
                        <IconLockOpen
                            v-if='event.editable'
                            :size='actionIconSize'
                            stroke='1'
                        />
                        <IconLock
                            v-else
                            :size='actionIconSize'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerDelete
                        v-if='is_creator'
                        displaytype='icon'
                        @delete='deleteEvent'
                    />
                </div>
            </div>

            <div
                v-if='saveError'
                class='col-12 flex-shrink-0 px-2 pt-2'
            >
                <TablerInlineAlert
                    severity='danger'
                    title='Change Not Saved'
                    :description='saveError.message'
                />
            </div>

            <div
                class='overflow-auto overflow-x-hidden core-event-properties flex-grow-1'
                style='min-height: 0;'
            >
                <div class='row g-0'>
                    <div class='pt-2 col-12 px-2'>
                        <PropertyType
                            :key='event.id'
                            :edit='is_editable'
                            :model-value='event.type'
                            @update:model-value='patch({ type: String($event) })'
                        />
                    </div>

                    <div class='col-12 pt-2'>
                        <Coordinate
                            :key='eventKey'
                            label='Location'
                            :edit='is_editable'
                            :hover='is_editable'
                            :model-value='event.geometry.coordinates'
                            @update:model-value='updateCoordinates($event as number[])'
                        />
                    </div>

                    <div class='col-12 pt-2'>
                        <PropertyCoreEventPriority
                            :model-value='event.priority'
                            :active='event.active'
                            :ended='event.ended'
                            :edit='is_editable'
                            @update:model-value='patch({ priority: $event as CoreEvent["priority"] })'
                            @update:active='patch({ active: $event })'
                        />
                    </div>

                    <div class='col-12 pt-2'>
                        <PropertyCoreEventLocation
                            :model-value='event.location'
                            :edit='is_editable'
                            @update:model-value='patch({ location: $event })'
                        />
                    </div>

                    <div class='col-12 pt-2'>
                        <PropertyCoreEventExternalId
                            :model-value='event.external_id'
                            :edit='is_editable'
                            @update:model-value='patch({ external_id: $event })'
                        />
                    </div>
                </div>

                <PropertyEmail
                    v-if='event.username'
                    :key='event.id'
                    :email='event.username'
                />

                <PropertyCoreEventMission
                    :model-value='event.mission_guid'
                    :edit='is_editable'
                    :event-name='event.name'
                    :remarks='event.remarks'
                    :channels='event.channels'
                    @update:model-value='patch({ mission_guid: $event })'
                />

                <div class='col-12'>
                    <SlideDownHeader
                        v-model='remarksExpanded'
                        label='Remarks'
                    >
                        <template #icon>
                            <IconBlockquote
                                :size='18'
                                stroke='1'
                                color='#6b7990'
                                class='ms-2 me-1'
                            />
                        </template>

                        <div class='px-2 pt-2'>
                            <CopyField
                                :model-value='event.remarks'
                                :rows='10'
                                :edit='is_editable'
                                :hover='is_editable'
                                @submit='patch({ remarks: String($event) })'
                            />
                        </div>
                    </SlideDownHeader>
                </div>

                <PropertyCoreEventLinks
                    :model-value='event.links'
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

                <PropertyCoreEventChannels
                    :model-value='event.channels'
                    :boards='event.boards'
                    :edit='is_creator'
                    @update:model-value='patch({ channels: $event })'
                />

                <PropertyCoreEventMetadata
                    :model-value='event.metadata'
                    :edit='is_editable'
                    @update:model-value='patch({ metadata: $event })'
                />

                <PropertyCoreEventTimes
                    :created='event.created'
                    :updated='event.updated'
                    :ended='event.ended'
                />
            </div>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    TablerNone,
    TablerAlert,
    TablerDelete,
    TablerIconButton,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import {
    IconLock,
    IconLockOpen,
    IconPencil,
    IconZoomPan,
    IconCircleX,
    IconBlockquote,
    IconExternalLink,
} from '@tabler/icons-vue';
import Type2525 from '@tak-ps/node-cot/2525';
import MenuTemplate from './util/MenuTemplate.vue';
import FeatureIcon from './util/FeatureIcon.vue';
import CopyField from './util/CopyField.vue';
import Coordinate from './util/Coordinate.vue';
import SlideDownHeader from './util/SlideDownHeader.vue';
import PropertyType from './Property/PropertyType.vue';
import PropertyStyle from './Property/PropertyStyle.vue';
import PropertyEmail from './Property/PropertyEmail.vue';
import PropertyCoreEventPriority from './Property/PropertyCoreEventPriority.vue';
import PropertyCoreEventLocation from './Property/PropertyCoreEventLocation.vue';
import PropertyCoreEventExternalId from './Property/PropertyCoreEventExternalId.vue';
import PropertyCoreEventLinks from './Property/PropertyCoreEventLinks.vue';
import PropertyCoreEventChannels from './Property/PropertyCoreEventChannels.vue';
import PropertyCoreEventMetadata from './Property/PropertyCoreEventMetadata.vue';
import PropertyCoreEventMission from './Property/PropertyCoreEventMission.vue';
import PropertyCoreEventTimes from './Property/PropertyCoreEventTimes.vue';
import type { CoreEvent, CoreEventStyle } from '../../types.ts';
import { server } from '../../std.ts';
import { useMapStore } from '../../stores/map.ts';
import ProfileConfig from '../../base/profile.ts';

// When an eventId prop is provided the view runs embedded (the Event Board
// modal) - the Event comes from the prop instead of the route and map
// integrations are disabled since no MapLibre instance exists on that page
const props = defineProps<{
    eventId?: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const embedded = computed(() => props.eventId !== undefined);
const eventKey = computed(() => props.eventId ?? String(route.params.event || ''));
const hasMap = computed(() => !!mapStore._map);

const event = ref<CoreEvent | undefined>();
const loading = ref(true);
const error = ref<Error | undefined>();

// A change the server rejected - kept apart from `error` so a failed save
// doesn't replace the Event with an error page
const saveError = ref<Error | undefined>();

const remarksExpanded = ref(true);
const actionIconSize = 28;

const profile = ref<{ username?: string, system_admin?: boolean }>({});

const is_creator = computed(() => {
    if (!event.value) return false;
    return !!profile.value.system_admin
        || (!!event.value.username && event.value.username === profile.value.username);
});

// The Event creator can always edit - everyone else only while the creator
// leaves the editable flag set
const is_editable = computed(() => {
    if (!event.value) return false;
    return is_creator.value || event.value.editable;
});

// The header icon isn't a CoT - FeatureIcon derives the MIL-STD symbol from the
// type the same way it does for one
const iconFeature = computed(() => {
    if (!event.value) return { properties: {}, geometry: { type: 'Point' } };

    return {
        properties: {
            type: event.value.type,
            icon: event.value.style.icon,
            'marker-color': event.value.style['marker-color'],
        },
        geometry: event.value.geometry,
    };
});

const styleProperties = computed(() => {
    if (!event.value) return {};

    // PropertyStyle falls back to the type when an icon is cleared
    return { ...event.value.style, type: event.value.type };
});

onMounted(async () => {
    const [username, systemAdmin] = await Promise.all([
        ProfileConfig.get('username'),
        ProfileConfig.get('system_admin'),
    ]);

    profile.value = {
        username: username?.value as string | undefined,
        system_admin: systemAdmin?.value as boolean | undefined,
    };

    // Standalone pages (Event Board) have no locally synced Profile - fall
    // back to the API so creator/editable checks still work there
    if (!profile.value.username) {
        try {
            const fetched = await ProfileConfig.fetch();

            profile.value = {
                username: fetched.username,
                system_admin: fetched.system_admin,
            };
        } catch (err) {
            console.error('Failed to fetch Profile', err);
        }
    }

    await fetchEvent();
});

watch(eventKey, async () => {
    await fetchEvent();
});

async function fetchEvent(): Promise<void> {
    if (!eventKey.value) return;

    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/event/{:event}', {
            params: {
                path: {
                    ':event': eventKey.value
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        // openapi-fetch widens the coordinate 2-tuple the API declares
        event.value = res.data as CoreEvent;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

// The PATCH response replaces local state so the view always renders
// server state rather than an optimistic local copy
async function patch(body: Record<string, unknown>): Promise<void> {
    if (!event.value) return;

    saveError.value = undefined;

    try {
        const res = await server.PATCH('/api/core/event/{:event}', {
            params: {
                path: {
                    ':event': event.value.id
                }
            },
            body
        });

        if (res.error) throw new Error(res.error.message);

        event.value = res.data as CoreEvent;

        await syncMapFeature();
    } catch (err) {
        // A rejected change must not take the whole view down with it - the
        // Event is reloaded so the UI stops showing a value the server refused
        await fetchEvent();

        saveError.value = err instanceof Error ? err : new Error(String(err));
    }
}

/**
 * Mirror a saved change onto the Event's map marker so it updates
 * immediately rather than on the next Event CoT broadcast
 */
async function syncMapFeature(): Promise<void> {
    if (!event.value || !mapStore._worker) return;

    try {
        const cot = await mapStore.worker.db.get(event.value.id);
        if (!cot) return;

        const properties = { ...cot.properties };

        properties.type = event.value.type;
        properties.callsign = event.value.name;
        properties.remarks = event.value.remarks;

        if (Type2525.isNumericSIDCConvertable(event.value.type)) {
            properties.milicon = { id: event.value.type };
        } else {
            delete properties.milicon;
        }

        // The derived icon sticks once set - strip it so it re-derives from
        // the new type unless the Event style pins an explicit icon
        if (event.value.style.icon) {
            properties.icon = event.value.style.icon;
        } else {
            delete properties.icon;
        }

        if (event.value.style['marker-color'] !== undefined) {
            properties['marker-color'] = event.value.style['marker-color'];
        } else {
            delete properties['marker-color'];
        }

        if (event.value.style['marker-opacity'] !== undefined) {
            properties['marker-opacity'] = event.value.style['marker-opacity'];
        } else {
            delete properties['marker-opacity'];
        }

        await cot.update({ properties });
    } catch (err) {
        console.error(`Failed to sync Event ${event.value.id} to its map feature:`, err);
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
    // Event style supports can be submitted back to the API
    const style: CoreEventStyle = {};

    if (typeof properties.icon === 'string') style.icon = properties.icon;
    if (typeof properties['marker-color'] === 'string') style['marker-color'] = properties['marker-color'];

    if (properties['marker-opacity'] !== undefined && !isNaN(Number(properties['marker-opacity']))) {
        style['marker-opacity'] = Number(properties['marker-opacity']);
    }

    void patch({ style });
}

function flyTo(): void {
    if (!event.value) return;

    mapStore.map.flyTo({
        center: [event.value.geometry.coordinates[0], event.value.geometry.coordinates[1]],
        zoom: Math.max(mapStore.map.getZoom(), 14),
    });
}

// The geometry change is synced back to the Event API by the Atlas Database
// when the edit finishes
async function editGeometry(): Promise<void> {
    if (!event.value) return;

    saveError.value = undefined;

    const cot = await mapStore.worker.db.get(event.value.id);

    if (!cot) {
        saveError.value = new Error('The Event marker is not currently on the map so its location cannot be edited here');
        return;
    }

    await mapStore.draw.edit(cot);
}

function openLink(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return;
    }

    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        window.open(parsed.href, '_blank', 'noopener,noreferrer');
    }
}

async function deleteEvent(): Promise<void> {
    if (!event.value) return;

    try {
        const res = await server.DELETE('/api/core/event/{:event}', {
            params: {
                path: {
                    ':event': event.value.id
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        // The Event is gone server side - drop its marker locally rather than
        // waiting for it to go stale on the map
        if (mapStore._worker) {
            try {
                await mapStore.worker.db.remove(event.value.id, { skipNetwork: true });
            } catch (err) {
                console.error(`Failed to remove deleted Event ${event.value.id} from the map:`, err);
            }
        }

        if (embedded.value) {
            emit('close');
        } else {
            router.push('/');
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

