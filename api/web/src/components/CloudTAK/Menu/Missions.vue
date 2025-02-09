<template>
    <MenuTemplate
        name='Data Syncs'
        :loading='loading'
    >
        <template #buttons>
            <TablerIconButton
                title='Create Sync'
                @click='create = true'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                title='Refresh'
                @click='fetchMissions'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <div class='col-12 px-2 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <ChannelInfo />

            <EmptyInfo v-if='profileStore.hasNoChannels' />

            <TablerNone
                v-if='!list.length'
                :create='false'
                label='Data Sync'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else>
                <div
                    v-for='(mission, mission_it) in filteredList'
                    :key='mission_it'
                    class='cursor-pointer col-12 py-2 hover-dark'
                    @click='openMission(mission, false)'
                >
                    <div class='px-3 d-flex'>
                        <div class='d-flex justify-content-center align-items-center'>
                            <IconLock
                                v-if='mission.passwordProtected'
                                :size='32'
                                stroke='1'
                            />
                            <IconLockOpen
                                v-else
                                :size='32'
                                stroke='1'
                            />
                        </div>
                        <div class='mx-2'>
                            <div class='col-12'>
                                <span v-text='mission.name' />
                            </div>
                            <div
                                v-if='typeof missionPasswords[mission.guid] === "string"'
                                class='d-flex'
                            >
                                <TablerInput
                                    v-model='missionPasswords[mission.guid]'
                                    placeholder='Password'
                                    :error='errors[mission.guid]'
                                    @keyup.enter='openMission(mission, true)'
                                />

                                <button
                                    class='btn btn-primary ms-2'
                                    @click='openMission(mission, true)'
                                >
                                    Unlock
                                </button>
                            </div>
                            <div
                                v-else
                                class='col-12'
                            >
                                <span
                                    class='text-secondary'
                                    v-text='mission.createTime.replace(/T.*/, "")'
                                />
                                &nbsp;-&nbsp;
                                <span
                                    class='text-secondary'
                                    v-text='mission.contents.length + " Items"'
                                />
                            </div>
                        </div>
                        <div class='col-auto ms-auto align-items-center d-flex'>
                            <IconAccessPoint
                                v-if='cotStore.subscriptions.has(mission.guid)'
                                v-tooltip='"Subscribed"'
                                :size='32'
                                stroke='1'
                                class='text-green'
                            />
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>

    <TablerModal
        v-if='create'
        size='xl'
        @keyup.esc='create = false'
    >
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='create = false'
        />
        <MissionCreate
            @mission='router.push(`/menu/missions/${$event.guid}`)'
            @close='create = false'
        />
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed } from 'vue';
import MissionCreate from './Mission/MissionCreate.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useRouter } from 'vue-router';
import {
    TablerIconButton,
    TablerInput,
    TablerNone,
    TablerAlert,
    TablerModal
} from '@tak-ps/vue-tabler';
import type { Mission } from '../../../../src/types.ts';
import { std, stdurl } from '../../../../src/std.ts';
import {
    IconPlus,
    IconLock,
    IconLockOpen,
    IconAccessPoint,
    IconRefresh,
} from '@tabler/icons-vue';
import ChannelInfo from '../util/ChannelInfo.vue';
import { useProfileStore } from '../../../../src/stores/profile.ts';
import EmptyInfo from '../util/EmptyInfo.vue';
import { useMapStore } from '../../../../src/stores/map.ts';
import { useCOTStore } from '../../../../src/stores/cots.ts';
import Subscription from '../../../../src/stores/base/mission.ts';
const mapStore = useMapStore();
const cotStore = useCOTStore();
const profileStore = useProfileStore();

const error = ref<Error | undefined>();
const create = ref(false)
const loading = ref(true)
const missionPasswords = ref<Record<string, string>>({});
const errors = ref<Record<string, string | undefined>>({})
const router = useRouter();

const paging = ref({ filter: '' });
const list = ref<Array<Mission>>([]);

onMounted(async () => {
    await fetchMissions();
});

const filteredList = computed((): Array<Mission> => {
    return list.value.filter((mission) => {
        return mission.name.toLowerCase()
            .includes(paging.value.filter.toLowerCase());
    }).sort((a) => {
        return !cotStore.subscriptions.has(a.guid) ? 1 : -1;
    })
});

async function openMission(mission: Mission, usePassword: boolean) {
    if (mission.passwordProtected && cotStore.subscriptions.has(mission.guid)) {
        const o = mapStore.getOverlayByMode('mission', mission.guid);

        let fragment = `/menu/missions/${mission.guid}`;
        if (o && o.token) fragment = `${fragment}?token=${encodeURIComponent(o.token)}`;
        router.push(fragment);
    } else if (mission.passwordProtected && usePassword) {
        try {
            const getMission = await fetchMission(mission, missionPasswords.value[mission.guid]);

            let fragment = `/menu/missions/${mission.guid}`;
            if (getMission && getMission.token) fragment = `${fragment}?token=${encodeURIComponent(getMission.token)}`;
            router.push(fragment);
        } catch (err) {
            if (err instanceof Error && err.message.includes('Illegal attempt to access mission')) {
                errors.value[mission.guid] = 'Invalid Password';
            } else {
                errors.value[mission.guid] = err instanceof Error ? err.message : String(err);
            }
        }
    } else if (mission.passwordProtected && missionPasswords.value[mission.guid] === undefined) {
        missionPasswords.value[mission.guid] = '';
    } else if (!mission.passwordProtected) {
        router.push(`/menu/missions/${mission.guid}?password=${encodeURIComponent(missionPasswords.value[mission.guid])}`);
    }
}

async function fetchMission(mission: Mission, password?: string): Promise<Mission> {
    const url = stdurl(`/api/marti/missions/${mission.guid}`);
    if (password) url.searchParams.append('password', password);

    const m = await std(url) as Mission;
    return m;
}

async function fetchMissions() {
    error.value = undefined;

    try {
        loading.value = true;

        list.value = (await Subscription.list()).data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
