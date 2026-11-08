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
            <div
                class='flex-grow-1 me-2'
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
            <div class='entity-actions d-flex align-items-center flex-nowrap px-2 py-1 border-bottom cloudtak-header flex-shrink-0'>
                <PropertyCoreEntityStatus
                    class='ps-1 me-1 flex-shrink-1'
                    style='min-width: 0; overflow: hidden;'
                    :started='event.started'
                    :ended='event.ended'
                    :priority='event.priority'
                />

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
                    title='Move Marker'
                    @click='editGeometry'
                >
                    <IconPencil
                        :size='actionIconSize'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    v-if='is_editable'
                    :title='event.active ? "End" : "Reactivate"'
                    @click='patch({ active: !event.active })'
                >
                    <IconPlayerStop
                        v-if='event.active'
                        :size='actionIconSize'
                        stroke='1'
                    />
                    <IconPlayerPlay
                        v-else
                        :size='actionIconSize'
                        stroke='1'
                    />
                </TablerIconButton>

                <div class='ms-auto d-flex align-items-center flex-nowrap'>
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
                        :size='actionIconSize'
                        @delete='deleteEvent'
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

            <PropertyTabs
                v-model='tab'
                :tabs='tabs'
                class='flex-shrink-0 pt-2'
            />

            <div
                class='overflow-auto overflow-x-hidden flex-grow-1'
                style='min-height: 0;'
            >
                <div
                    v-show='tab === "timeline"'
                    class='h-100'
                >
                    <PropertyCoreEntityTimeline
                        :entity='event.id'
                        :edit='is_editable'
                        @change='timelineChanged'
                    />
                </div>

                <div
                    v-show='tab === "details"'
                    class='pt-1'
                >
                    <div class='px-2 pb-2'>
                        <AppearanceRow
                            :properties='entityAppearance(event)'
                            :geometry='event.geometry'
                            :edit='is_editable && !embedded'
                            @click='router.push(`/event/${event.id}/appearance`)'
                        />
                    </div>

                    <div class='px-2 pb-2'>
                        <PropertyCoreEntityLatestActivity
                            :entry='latest'
                            :total='timelineTotal'
                            :edit='is_editable'
                            @open='tab = "timeline"'
                        />
                    </div>

                    <PropertyFactRow
                        label='Location'
                        class='py-1'
                    >
                        <CopyField
                            :model-value='event.location || "None"'
                            :edit='is_editable'
                            :hover='is_editable'
                            :size='24'
                            @submit='patch({ location: String($event) })'
                        />
                    </PropertyFactRow>

                    <PropertyFactRow
                        label='Coords'
                        class='py-1'
                    >
                        <Coordinate
                            :key='eventKey'
                            :inline='true'
                            :edit='is_editable'
                            :hover='is_editable'
                            :model-value='event.geometry.coordinates'
                            @update:model-value='updateCoordinates($event as number[])'
                        />
                    </PropertyFactRow>

                    <PropertyCoreEntityDuration
                        :started='event.started'
                        :ended='event.ended'
                        :edit='is_editable'
                        @update:started='patch({ started: $event })'
                        @update:ended='patch({ ended: $event })'
                    />

                    <PropertyCoreEntityPriority
                        :model-value='event.priority'
                        :edit='is_editable'
                        @update:model-value='patch({ priority: $event as CoreEntity["priority"] })'
                    />

                    <PropertyFactRow
                        v-if='event.username'
                        label='Creator'
                    >
                        <a
                            :href='`mailto:${event.username}`'
                            class='text-reset d-block text-truncate'
                            v-text='event.username'
                        />
                    </PropertyFactRow>

                    <PropertyRemarks
                        :model-value='event.remarks'
                        :edit='is_editable'
                        @submit='patch({ remarks: $event })'
                    />

                    <PropertyCoreEntityLinks
                        :model-value='event.links'
                        :edit='is_editable'
                        @update:model-value='patch({ links: $event })'
                    />

                    <PropertyCoreEntityMission
                        :model-value='event.missions'
                        :edit='is_editable'
                        :event-name='event.name'
                        :remarks='event.remarks'
                        :channels='event.channels'
                        @update:model-value='patch({ missions: $event })'
                    />

                    <PropertyCoreEntityExternalId
                        :model-value='event.external_ids'
                        :edit='is_editable'
                        @update:model-value='patch({ external_id: $event })'
                    />

                    <PropertyCoreEntityMetadata
                        :model-value='event.metadata'
                        :edit='is_editable'
                        @update:model-value='patch({ metadata: $event })'
                    />
                </div>

                <div v-show='tab === "channels"'>
                    <PropertyCoreEntityChannels
                        :model-value='event.channels'
                        :boards='event.boards'
                        :edit='is_creator'
                        @update:model-value='patch({ channels: $event })'
                        @nominate='nominate($event)'
                    />
                </div>

                <div v-show='tab === "assignments"'>
                    <PropertyCoreEntityAssignments
                        :event='event.id'
                        :edit='is_editable'
                    />
                </div>

                <div v-show='tab === "forms"'>
                    <PropertyCoreEntityForms
                        :event='event.id'
                        :refresh='formsRefresh'
                        :channels='event.channels'
                        :edit='is_editable'
                        @add='completeForm($event)'
                        @edit='editResponse($event)'
                    />
                </div>
            </div>

            <PropertyCoreEntityTimes
                :created='event.created'
                :updated='event.updated'
                :username='event.username'
            />
        </div>

        <FormWizard
            v-if='formWizard && event'
            :event-id='event.id'
            :event-name='event.name'
            :forms='formWizard.forms'
            :title='formWizard.title'
            :response='formWizard.response'
            @complete='completeFormWizard'
            @close='formWizard = undefined; formsRefresh += 1'
        />
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
    IconLock,
    IconLockOpen,
    IconPencil,
    IconZoomPan,
    IconCircleX,
    IconPlayerStop,
    IconPlayerPlay,
    IconForms,
    IconClockEdit,
    IconAffiliate,
    IconUserCheck,
    IconListDetails,
} from '@tabler/icons-vue';
import MenuTemplate from './util/MenuTemplate.vue';
import CopyField from './util/CopyField.vue';
import Coordinate from './util/Coordinate.vue';
import PropertyFactRow from './util/PropertyFactRow.vue';
import PropertyTabs, { type PropertyTab } from './util/PropertyTabs.vue';
import AppearanceRow from './Appearance/AppearanceRow.vue';
import PropertyRemarks from './Property/PropertyRemarks.vue';
import PropertyCoreEntityPriority from './Property/PropertyCoreEntityPriority.vue';
import PropertyCoreEntityDuration from './Property/PropertyCoreEntityDuration.vue';
import PropertyCoreEntityExternalId from './Property/PropertyCoreEntityExternalId.vue';
import PropertyCoreEntityLinks from './Property/PropertyCoreEntityLinks.vue';
import PropertyCoreEntityChannels from './Property/PropertyCoreEntityChannels.vue';
import PropertyCoreEntityForms from './Property/PropertyCoreEntityForms.vue';
import PropertyCoreEntityAssignments from './Property/PropertyCoreEntityAssignments.vue';
import PropertyCoreEntityMetadata from './Property/PropertyCoreEntityMetadata.vue';
import PropertyCoreEntityMission from './Property/PropertyCoreEntityMission.vue';
import PropertyCoreEntityTimes from './Property/PropertyCoreEntityTimes.vue';
import PropertyCoreEntityStatus from './Property/PropertyCoreEntityStatus.vue';
import PropertyCoreEntityTimeline from './Property/PropertyCoreEntityTimeline.vue';
import PropertyCoreEntityLatestActivity from './Property/PropertyCoreEntityLatestActivity.vue';
import FormWizard from './util/FormWizard.vue';
import type { CoreForm, CoreEntity, CoreEntityBoardSummary, CoreEntityFormResponse, CoreEntityTimelineEntry } from '../../types.ts';
import { server } from '../../std.ts';
import { db, liveQuery } from '../../database.ts';
import { missingRequiredForms } from '../../utils/column-forms.ts';
import { useMapStore } from '../../stores/map.ts';
import { useEntityAccess } from '../../utils/entity-access.ts';
import { entityMarkerProperties, entityAppearance } from '../../utils/core-entity.ts';

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
const actionIconSize = 28;

const event = ref<CoreEntity | undefined>();
const loading = ref(true);
const error = ref<Error | undefined>();

// A change the server rejected - kept apart from `error` so a failed save
// doesn't replace the Event with an error page
const saveError = ref<Error | undefined>();

/**
 * Forms open in the FormWizard - a nomination held back by required Forms
 * carries the Column to place the Event in once they are submitted, a Form
 * picked from the Forms section carries none
 */
const formWizard = ref<{
    forms: Array<CoreForm>;
    column?: string;
    title?: string;
    response?: { id: string; response: Record<string, unknown> };
} | undefined>();

/** Bumped when the wizard submits Responses so the Forms section re-fetches */
const formsRefresh = ref(0);

const tab = ref('details');

/** Newest Timeline entry & total - the Latest Activity row and the tab badge */
const latest = ref<CoreEntityTimelineEntry | undefined>();
const timelineTotal = ref(0);

const tabs = computed<Array<PropertyTab>>(() => [
    { value: 'details', label: 'Details', icon: IconListDetails },
    { value: 'timeline', label: 'Timeline', icon: IconClockEdit, count: timelineTotal.value },
    { value: 'channels', label: 'Channels', icon: IconAffiliate },
    { value: 'assignments', label: 'Assignments', icon: IconUserCheck },
    { value: 'forms', label: 'Forms', icon: IconForms },
]);

const { is_creator, is_editable, load: loadAccess } = useEntityAccess(event);

onMounted(async () => {
    await loadAccess();
    await fetchEvent();
    watchCot();
});

onBeforeUnmount(() => {
    unwatchCot();
});

watch(eventKey, async () => {
    await fetchEvent();
    watchCot();
});

async function fetchEvent(): Promise<void> {
    if (!eventKey.value) return;

    loading.value = true;
    error.value = undefined;

    try {
        event.value = await loadEvent();
        await loadLatest();

        // An Event with a narrative opens on it, a fresh one on its facts
        tab.value = timelineTotal.value ? 'timeline' : 'details';
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

/** The newest Timeline entry - a failure here leaves the Event up without the Latest Activity row */
async function loadLatest(): Promise<void> {
    if (!event.value) return;

    try {
        const res = await server.GET('/api/core/entity/{:entity}/timeline', {
            params: {
                path: { ':entity': event.value.id },
                query: {
                    limit: 1,
                    page: 0,
                    order: 'desc',
                    sort: 'occurred',
                    filter: '',
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        latest.value = res.data.items[0];
        timelineTotal.value = res.data.total;
    } catch (err) {
        console.error('Failed to load the Timeline of Core Event', err);
    }
}

function timelineChanged(total: number): void {
    timelineTotal.value = total;
    void loadLatest();
}

/** Reload server state in place - no loading flash, the current Event stays up on failure */
async function refreshEvent(): Promise<void> {
    if (!eventKey.value) return;

    try {
        event.value = await loadEvent();
    } catch (err) {
        console.error('Failed to refresh Core Event', err);
    }
}

async function loadEvent(): Promise<CoreEntity> {
    const res = await server.GET('/api/core/event/{:event}', {
        params: {
            path: {
                ':event': eventKey.value
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    // openapi-fetch widens the coordinate 2-tuple the API declares
    return res.data as CoreEntity;
}

/**
 * The API rebroadcasts the Event CoT when its Board placement changes. The
 * placement itself is not carried on the CoT, so a new broadcast time on the
 * locally stored feature is the cue to refetch the Event
 */
let cotSubscription: { unsubscribe: () => void } | undefined;

function watchCot(): void {
    unwatchCot();

    if (embedded.value || !eventKey.value) return;

    const id = eventKey.value;
    let seeded = false;
    let lastTime: string | undefined;

    cotSubscription = liveQuery(() => db.feature.get(id)).subscribe((feat) => {
        const time = feat ? feat.properties.time : undefined;

        if (seeded && time !== lastTime) void refreshEvent();

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

        event.value = res.data as CoreEntity;

        await syncMapFeature();
    } catch (err) {
        // A rejected change must not take the whole view down with it - the
        // Event is reloaded so the UI stops showing a value the server refused
        await fetchEvent();

        saveError.value = err instanceof Error ? err : new Error(String(err));
    }
}

/**
 * Nominate the Event onto a Board - it lands in the Board's automatically
 * managed Nominated Column, then the Event is reloaded so the Channels
 * section reflects the new placement. A Nominated Column with required
 * Forms surfaces the FormWizard first and the nomination completes with it
 */
async function nominate(board: CoreEntityBoardSummary): Promise<void> {
    if (!event.value) return;

    const column = board.columns.find((c) => c.type === 'nominated');
    if (!column) {
        saveError.value = new Error(`${board.name} has no Nominated Column`);
        return;
    }

    saveError.value = undefined;

    try {
        const missing = await missingRequiredForms(column.id, event.value.id);

        if (missing.length) {
            formWizard.value = { forms: missing, column: column.id };
            return;
        }

        await placeNomination(column.id);
    } catch (err) {
        saveError.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function placeNomination(column: string): Promise<void> {
    if (!event.value) return;

    const res = await server.PUT('/api/board/event', {
        body: {
            column,
            event: event.value.id,
            position: 0,
        }
    });

    if (res.error) throw new Error(res.error.message);

    await fetchEvent();
}

/** Complete any Form shared with one of the Event's Channels */
function completeForm(form: CoreForm): void {
    formWizard.value = { forms: [form], title: 'Complete Form' };
}

function editResponse(item: CoreEntityFormResponse): void {
    formWizard.value = {
        forms: [item.form],
        title: 'Edit Response',
        response: { id: item.id, response: item.response },
    };
}

async function completeFormWizard(): Promise<void> {
    const pending = formWizard.value;
    formWizard.value = undefined;

    if (!pending) return;

    formsRefresh.value += 1;

    if (!pending.column) return;

    try {
        await placeNomination(pending.column);
    } catch (err) {
        saveError.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function syncMapFeature(): Promise<void> {
    if (!event.value || !mapStore._worker) return;

    try {
        const cot = await mapStore.worker.db.get(event.value.id);
        if (!cot) return;

        await cot.update({ properties: entityMarkerProperties(cot.properties, event.value) });
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


<style scoped>
.entity-actions :deep(svg) {
    display: block;
}
</style>
