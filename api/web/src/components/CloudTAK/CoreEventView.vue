<template>
    <MenuTemplate
        :scroll='false'
        :loading='loading'
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
            :key='String(route.params.event)'
            class='d-flex flex-column h-100'
            style='min-height: 0;'
        >
            <div class='col-12 border-bottom cloudtak-bg flex-shrink-0 d-flex align-items-center flex-nowrap gap-0 px-1 py-1'>
                <div class='btn-list d-flex flex-nowrap align-items-center gap-0 mb-0'>
                    <TablerIconButton
                        title='Zoom To'
                        @click='flyTo'
                    >
                        <IconZoomPan
                            :size='actionIconSize'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        v-if='is_editable'
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
                            :key='String(route.params.event)'
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
                            :edit='is_editable'
                            @update:model-value='patch({ priority: $event as CoreEvent["priority"] })'
                        />
                    </div>

                    <div class='col-12 pt-2'>
                        <PropertyCoreEventStatus
                            :active='event.active'
                            :ended='event.ended'
                            :edit='is_editable'
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

                    <div
                        v-if='event.username'
                        class='col-12 pt-2'
                    >
                        <PropertyEmail
                            :key='event.id'
                            :email='event.username'
                        />
                    </div>
                </div>

                <PropertyCoreEventMission
                    class='pt-2'
                    :model-value='event.mission_guid'
                    :edit='is_editable'
                    :event-name='event.name'
                    :remarks='event.remarks'
                    :channels='event.channels'
                    @update:model-value='patch({ mission_guid: $event })'
                />

                <div class='col-12 pt-2'>
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
                    class='pt-2'
                    :model-value='event.links'
                    :edit='is_editable'
                    @update:model-value='patch({ links: $event })'
                />

                <!-- PropertyStyle is always interactive - a user who can't edit
                     the Event would only get a 403 from the API -->
                <PropertyStyle
                    v-if='is_editable'
                    class='pt-2'
                    geometry='Point'
                    :model-value='styleProperties'
                    @update:model-value='updateStyle($event)'
                />

                <PropertyCoreEventChannels
                    class='pt-2'
                    :model-value='event.channels'
                    :edit='is_creator'
                    @update:model-value='patch({ channels: $event })'
                />

                <PropertyCoreEventMetadata
                    class='pt-2'
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
import PropertyCoreEventStatus from './Property/PropertyCoreEventStatus.vue';
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

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

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

// The header icon isn't a CoT so the 2525E icon the map would have generated
// for the Event has to be derived from the type here
const iconFeature = computed(() => {
    if (!event.value) return { properties: {}, geometry: { type: 'Point' } };

    const icon = event.value.style.icon
        || (Type2525.isNumericSIDCConvertable(event.value.type) ? `2525E:${event.value.type}` : undefined);

    return {
        properties: {
            type: event.value.type,
            icon,
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

    await fetchEvent();
});

watch(() => route.params.event, async () => {
    await fetchEvent();
});

async function fetchEvent(): Promise<void> {
    if (!route.params.event) return;

    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/event/{:event}', {
            params: {
                path: {
                    ':event': String(route.params.event)
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

/**
 * Submit a change to the Event - the API returns the updated Event so the
 * view always renders server state rather than an optimistic local copy
 */
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
    if (!event.value) return;

    try {
        const cot = await mapStore.worker.db.get(event.value.id);
        if (!cot) return;

        const properties = { ...cot.properties };

        properties.type = event.value.type;
        properties.callsign = event.value.name;
        properties.remarks = event.value.remarks;

        if (Type2525.isNumericSIDCConvertable(event.value.type)) {
            properties.milicon = { id: event.value.type };
        }

        // The icon is derived once and then sticks - strip it (and mirror the
        // style overrides) so styleProperties re-derives it from the new type
        // unless the Event style pins an explicit icon
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
    window.open(url, '_blank', 'noopener,noreferrer');
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

        router.push('/');
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

<style scoped>
:global(html[data-bs-theme='dark'] .core-event-properties .cloudtak-accent) {
    background-color: #192f45 !important;
    border: 1px solid rgba(255, 255, 255, 0.14);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}
</style>
