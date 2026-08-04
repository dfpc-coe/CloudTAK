<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Mission'
        >
            <template #icon>
                <IconAmbulance
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <TablerBadge
                    class='me-2'
                    background-color='rgba(59, 130, 246, 0.15)'
                    border-color='rgba(59, 130, 246, 0.4)'
                    text-color='#3b82f6'
                >
                    {{ props.modelValue ? 1 : 0 }}
                </TablerBadge>
            </template>

            <div class='overflow-hidden mb-2'>
                <div class='rounded mx-2 mt-2 px-2 py-2'>
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

                    <div
                        v-else-if='props.modelValue'
                        class='d-flex align-items-center gap-1'
                    >
                        <TablerButton
                            class='w-100 d-flex align-items-center text-start'
                            :title='name'
                            @click='router.push(`/menu/missions/${props.modelValue}`)'
                        >
                            <IconAmbulance
                                :size='20'
                                stroke='1'
                                class='flex-shrink-0'
                            />
                            <span
                                class='mx-2 text-truncate'
                                v-text='name'
                            />
                        </TablerButton>

                        <TablerIconButton
                            v-if='props.edit'
                            title='Remove Associated Mission'
                            @click='emit("update:modelValue", null)'
                        >
                            <IconTrash
                                :size='18'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>

                    <template v-else-if='mode === "select"'>
                        <div class='d-flex align-items-center mb-2'>
                            <div class='subheader user-select-none'>
                                Select Mission
                            </div>
                            <div class='ms-auto'>
                                <TablerIconButton
                                    title='Cancel Mission Selection'
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
                                    <IconAmbulance
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
                            v-if='!props.edit'
                            class='px-1 py-1 text-muted'
                        >
                            No Associated Mission
                        </div>
                        <div
                            v-else
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
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import Subscription from '../../../base/subscription.ts';
import GroupManager from '../../../base/group.ts';
import OverlayManager from '../../../base/overlay.ts';
import { useMapStore } from '../../../stores/map.ts';
import { server } from '../../../std.ts';
import type { Mission } from '../../../types.ts';
import {
    TablerBadge,
    TablerButton,
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
    IconAmbulance,
    IconListSearch,
} from '@tabler/icons-vue';

const props = defineProps<{
    /** GUID of the TAK Server Mission the Event is associated with */
    modelValue: string | null;
    edit?: boolean;
    /** Event name - becomes the name of a new Mission */
    eventName?: string;
    /** Event remarks - become the description of a new Mission */
    remarks?: string;
    /** Event Channel bitpositions - become the Channels of a new Mission */
    channels?: Array<number>;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string | null): void
}>();

const router = useRouter();
const mapStore = useMapStore();

const expanded = ref(!!props.modelValue);
const mode = ref<'view' | 'select'>('view');

const error = ref<Error | undefined>();
const busy = ref(false);

// The Mission is only named locally if the user is subscribed to it -
// otherwise the name comes from the listing cache or falls back to the GUID
const name = ref('');

const missions = ref<Array<Mission>>([]);
const listLoading = ref(false);
const filter = ref('');

const filteredMissions = computed(() => {
    return missions.value.filter((mission) => {
        return mission.name.toLowerCase().includes(filter.value.toLowerCase());
    });
});

onMounted(async () => {
    await loadName();
});

watch(() => props.modelValue, async () => {
    mode.value = 'view';
    if (props.modelValue) expanded.value = true;
    await loadName();
});

async function loadName(): Promise<void> {
    if (!props.modelValue) {
        name.value = '';
        return;
    }

    const subscription = await Subscription.from(props.modelValue);

    if (subscription) {
        name.value = subscription.meta.name;
        return;
    }

    const listed = missions.value.find((mission) => mission.guid === props.modelValue);
    name.value = listed ? listed.name : props.modelValue;
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
    name.value = mission.name;
    mode.value = 'view';

    emit('update:modelValue', mission.guid);
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

        name.value = res.data.name;
        mode.value = 'view';

        emit('update:modelValue', res.data.guid);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    busy.value = false;
}
</script>
