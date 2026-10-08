<template>
    <PropertySection
        label='Mission'
        :count='props.modelValue.length'
    >
        <TablerInlineAlert
            v-if='error'
            class='mb-2'
            severity='danger'
            title='Mission Error'
            :description='error.message'
        />

        <TablerLoading
            v-if='busy'
            :compact='true'
            desc='Creating Mission'
        />

        <template v-else-if='mode === "select"'>
            <div class='d-flex align-items-center mb-2 user-select-none'>
                <TablerIconButton
                    title='Back'
                    @click='mode = "view"'
                >
                    <IconChevronLeft
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <div class='mx-2 subheader'>
                    Select Mission
                </div>
            </div>

            <TablerLoading
                v-if='listLoading'
                :compact='true'
                desc='Loading Missions'
            />
            <template v-else>
                <TablerInput
                    v-model='filter'
                    placeholder='Filter Missions...'
                    class='pb-2'
                />

                <div
                    class='overflow-auto'
                    style='max-height: 250px;'
                >
                    <div
                        v-if='!filteredMissions.length'
                        class='px-1 py-1 text-muted'
                    >
                        No Missions Found
                    </div>
                    <div
                        v-for='mission of filteredMissions'
                        :key='mission.guid'
                        class='cloudtak-hover rounded cursor-pointer d-flex align-items-center px-2 py-2'
                        @click='selectMission(mission)'
                    >
                        <IconLock
                            v-if='mission.passwordProtected'
                            :size='18'
                            stroke='1'
                            class='me-2 flex-shrink-0'
                        />
                        <IconCloudPin
                            v-else
                            :size='18'
                            stroke='1'
                            class='me-2 flex-shrink-0'
                        />
                        <span
                            class='text-truncate'
                            v-text='mission.name'
                        />
                    </div>
                </div>
            </template>
        </template>

        <template v-else>
            <div
                v-for='mission of props.modelValue'
                :key='mission.guid'
                class='d-flex align-items-center gap-1 mb-2'
            >
                <TablerButton
                    class='w-100 d-flex align-items-center text-start'
                    :title='mission.name'
                    @click='router.push(`/menu/missions/${mission.guid}`)'
                >
                    <IconCloudPin
                        :size='20'
                        stroke='1'
                        class='flex-shrink-0'
                    />
                    <span
                        class='mx-2 text-truncate'
                        v-text='mission.name'
                    />
                </TablerButton>

                <TablerIconButton
                    v-if='props.edit'
                    title='Remove Associated Mission'
                    @click='removeMission(mission.guid)'
                >
                    <IconTrash
                        :size='18'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>

            <div
                v-if='!props.edit && !props.modelValue.length'
                class='px-1 py-1 text-muted'
            >
                No Associated Missions
            </div>
            <div
                v-else-if='props.edit'
                class='d-flex gap-2'
            >
                <TablerButton
                    class='w-50 d-flex align-items-center justify-content-center'
                    title='Associate an existing Mission with the Event'
                    @click='startSelect'
                >
                    <IconListSearch
                        :size='18'
                        stroke='1'
                        class='me-2 flex-shrink-0'
                    />
                    Existing Mission
                </TablerButton>
                <TablerButton
                    class='w-50 d-flex align-items-center justify-content-center'
                    title='Create a new Mission from the Event name, remarks & channels'
                    @click='createMission'
                >
                    <IconPlus
                        :size='18'
                        stroke='1'
                        class='me-2 flex-shrink-0'
                    />
                    New Mission
                </TablerButton>
            </div>
        </template>
    </PropertySection>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import PropertySection from '../util/PropertySection.vue';
import Subscription from '../../../base/subscription.ts';
import GroupManager from '../../../base/group.ts';
import OverlayManager from '../../../base/overlay.ts';
import { useMapStore } from '../../../stores/map.ts';
import { server } from '../../../std.ts';
import type { Mission, CoreEntityMission } from '../../../types.ts';
import {
    TablerButton,
    TablerInput,
    TablerLoading,
    TablerIconButton,
    TablerInlineAlert,
} from '@tak-ps/vue-tabler';
import {
    IconLock,
    IconPlus,
    IconTrash,
    IconCloudPin,
    IconListSearch,
    IconChevronLeft,
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
const mapStore = useMapStore();

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
        error.value = new Error('The Event must have a name before a Mission can be created from it');
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

            await mapStore.loadMission(res.data.guid);
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
