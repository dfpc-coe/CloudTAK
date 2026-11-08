<template>
    <PropertySection label='Data Syncs'>
        <template #actions>
            <template v-if='props.edit && mode === "view" && !busy'>
                <TablerIconButton
                    title='Add an existing Data Sync'
                    @click.stop='startSelect'
                >
                    <IconListSearch
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Create a Data Sync from the Event name, remarks & channels'
                    @click.stop='createMission'
                >
                    <IconPlus
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </template>
        </template>

        <TablerInlineAlert
            v-if='error'
            class='mb-2'
            severity='danger'
            title='Data Sync Error'
            :description='error.message'
        />

        <TablerLoading
            v-if='busy'
            :compact='true'
            desc='Creating Data Sync'
        />

        <div
            v-else-if='mode === "select"'
            class='rounded mb-2 px-2 py-2 cloudtak-accent'
        >
            <div class='d-flex align-items-center mb-2 user-select-none'>
                <div class='subheader'>
                    Select Data Sync
                </div>
                <div class='ms-auto'>
                    <TablerIconButton
                        title='Cancel'
                        @click='mode = "view"'
                    >
                        <IconX
                            :size='18'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>

            <TablerLoading
                v-if='listLoading'
                :compact='true'
                desc='Loading Data Syncs'
            />
            <template v-else>
                <TablerInput
                    v-model='filter'
                    placeholder='Filter Data Syncs...'
                    class='pb-2'
                />

                <div
                    class='overflow-auto'
                    style='max-height: 250px;'
                >
                    <TablerNone
                        v-if='!filteredMissions.length'
                        label='No Data Syncs Found'
                        :compact='true'
                        :create='false'
                    />
                    <div
                        v-for='mission of filteredMissions'
                        :key='mission.guid'
                        class='mission-row d-flex align-items-center gap-2 px-2 rounded cursor-pointer'
                        style='min-height: 36px;'
                        @click='selectMission(mission)'
                    >
                        <IconLock
                            v-if='mission.passwordProtected'
                            :size='18'
                            stroke='1'
                            class='text-secondary flex-shrink-0'
                        />
                        <IconCloudPin
                            v-else
                            :size='18'
                            stroke='1'
                            class='text-secondary flex-shrink-0'
                        />
                        <span
                            class='text-truncate'
                            v-text='mission.name'
                        />
                    </div>
                </div>
            </template>
        </div>

        <template v-else>
            <TablerNone
                v-if='!props.modelValue.length'
                label='No Data Syncs'
                class='pb-2'
                :compact='true'
                :create='false'
            />

            <div
                v-for='mission of props.modelValue'
                :key='mission.guid'
                class='mission-row d-flex align-items-center gap-2 px-2 rounded'
            >
                <a
                    :href='`/menu/missions/${mission.guid}`'
                    :title='mission.name'
                    class='d-flex align-items-center gap-2 text-reset text-decoration-none flex-fill'
                    style='min-width: 0; min-height: 36px;'
                    @click.prevent='router.push(`/menu/missions/${mission.guid}`)'
                >
                    <IconCloudPin
                        :size='18'
                        stroke='1'
                        class='text-secondary flex-shrink-0'
                    />
                    <span
                        class='text-truncate'
                        v-text='mission.name'
                    />
                </a>

                <TablerIconButton
                    v-if='props.edit'
                    title='Remove Data Sync'
                    class='mission-row-remove'
                    @click='removeMission(mission.guid)'
                >
                    <IconTrash
                        :size='18'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </template>
    </PropertySection>
</template>

<script setup lang='ts'>
/** PropertyCoreEntityMission - the TAK Server Data Syncs (Missions) of a Core Event as a compact row list */
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import PropertySection from '../util/PropertySection.vue';
import Subscription from '../../../base/subscription.ts';
import GroupManager from '../../../base/group.ts';
import OverlayManager from '../../../base/overlay.ts';
import { server } from '../../../std.ts';
import type { Mission, CoreEntityMission } from '../../../types.ts';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerIconButton,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconLock,
    IconPlus,
    IconTrash,
    IconCloudPin,
    IconListSearch,
} from '@tabler/icons-vue';

const props = defineProps<{
    /** TAK Server Missions the Event is associated with */
    modelValue: Array<CoreEntityMission>;
    edit?: boolean;
    /** Event name - becomes the name of a new Mission */
    eventName?: string;
    /** Event remarks - become the description of a new Mission */
    remarks?: string;
    /** Event Channel bitpositions - become the Channels of a new Mission */
    channels?: Array<number>;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Array<CoreEntityMission>): void
}>();

const router = useRouter();

const mode = ref<'view' | 'select'>('view');

const error = ref<Error | undefined>();
const busy = ref(false);

const missions = ref<Array<Mission>>([]);
const listLoading = ref(false);
const filter = ref('');

// Missions already associated with the Event are not offered again
const filteredMissions = computed(() => {
    const associated = new Set(props.modelValue.map((mission) => mission.guid));

    return missions.value.filter((mission) => {
        return !associated.has(mission.guid)
            && mission.name.toLowerCase().includes(filter.value.toLowerCase());
    });
});

watch(() => props.modelValue, () => {
    mode.value = 'view';
});

function addMission(mission: CoreEntityMission): void {
    if (props.modelValue.some((existing) => existing.guid === mission.guid)) return;

    emit('update:modelValue', [...props.modelValue, mission]);
}

function removeMission(guid: string): void {
    emit('update:modelValue', props.modelValue.filter((mission) => mission.guid !== guid));
}

async function startSelect(): Promise<void> {
    mode.value = 'select';
    error.value = undefined;
    filter.value = '';

    listLoading.value = true;

    try {
        const res = await Subscription.list();
        missions.value = res.items;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        mode.value = 'view';
    }

    listLoading.value = false;
}

function selectMission(mission: Mission): void {
    mode.value = 'view';

    addMission({ name: mission.name, guid: mission.guid });
}

// Create a Mission from the Event - its name, remarks and Channels carry over
async function createMission(): Promise<void> {
    const missionName = (props.eventName || '').trim();

    error.value = undefined;

    if (!missionName) {
        error.value = new Error('The Event must have a name before a Data Sync can be created from it');
        return;
    }

    busy.value = true;

    try {
        // Channels the user can't see have no name to resolve - they're
        // dropped rather than blocking the Mission creation
        const groups = await GroupManager.list();
        const group = [...new Set(groups
            .filter((channel) => (props.channels || []).includes(channel.bitpos))
            .map((channel) => channel.name))];

        const res = await server.POST('/api/marti/mission', {
            body: {
                name: missionName,
                group,
                description: props.remarks || '',
                keywords: [],
            }
        });

        if (res.error) throw new Error(res.error.message);

        // Load the new Mission onto the map like one created from the Missions
        // menu - the association still proceeds if this fails
        try {
            await OverlayManager.createLoaded({
                name: res.data.name,
                url: `/mission/${encodeURIComponent(res.data.guid)}`,
                type: 'geojson',
                mode: 'mission',
                token: res.data.token,
                mode_id: res.data.guid,
            });
        } catch (err) {
            console.error('Failed to load the new Mission onto the map:', err);
        }

        mode.value = 'view';

        addMission({ name: res.data.name, guid: res.data.guid });
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    busy.value = false;
}
</script>

<style scoped>
.mission-row:hover {
    background: var(--cloudtak-hover-bg);
}

.mission-row-remove {
    visibility: hidden;
}

.mission-row:hover .mission-row-remove,
.mission-row:focus-within .mission-row-remove {
    visibility: visible;
}
</style>
