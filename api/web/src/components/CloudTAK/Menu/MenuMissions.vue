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
                    :size='ICON_SIZE'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchMissions'
            />
        </template>
        <template #default>
            <div class='d-flex flex-column gap-3 p-2'>
                <div class='d-flex flex-column flex-sm-row align-items-sm-center gap-2'>
                    <TablerInput
                        v-model='paging.filter'
                        :autofocus='true'
                        icon='search'
                        placeholder='Filter data syncs'
                        class='flex-grow-1'
                    />
                </div>

                <ChannelInfo />

                <EmptyInfo v-if='mapStore.hasNoChannels' />

                <TablerLoading v-if='loading' />
                <template v-else>
                    <TablerAlert
                        v-if='error'
                        :err='error'
                    />
                    <template v-else>
                        <TablerNone
                            v-if='!filteredList.length'
                            :create='false'
                            label='No data syncs match your filter'
                            class='px-2'
                        />
                        <div
                            v-else
                            class='d-flex flex-column gap-3'
                        >
                            <article
                                v-for='(mission, mission_it) in filteredList'
                                :key='mission_it'
                                class='border border-white border-opacity-25 rounded-4 bg-dark bg-opacity-25 p-3 text-white d-flex flex-column flex-md-row gap-3 position-relative'
                                role='button'
                                tabindex='0'
                                @click='openMission(mission, false)'
                                @keydown.enter.prevent='openMission(mission, false)'
                                @keydown.space.prevent='openMission(mission, false)'
                            >
                                <div class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 p-2'>
                                    <IconLock
                                        v-if='mission.passwordProtected'
                                        :size='ICON_SIZE'
                                        stroke='1'
                                    />
                                    <IconLockOpen
                                        v-else
                                        :size='ICON_SIZE'
                                        stroke='1'
                                    />
                                </div>

                                <div class='flex-grow-1 d-flex flex-column gap-2'>
                                    <div class='d-flex flex-wrap align-items-center gap-2'>
                                        <span
                                            class='fw-semibold text-truncate'
                                            v-text='mission.name'
                                        />
                                    </div>

                                    <div
                                        v-if='missionKeywords(mission).length'
                                        class='d-flex flex-wrap align-items-center gap-2'
                                    >
                                        <span
                                            v-for='keyword in missionKeywords(mission)'
                                            :key='`${mission.guid}-${keyword}`'
                                            class='badge rounded-pill text-bg-info text-uppercase small fw-semibold'
                                            v-text='keyword'
                                        />
                                    </div>
                                    <div
                                        v-else
                                        class='text-secondary small'
                                    >
                                        No keywords
                                    </div>

                                    <div
                                        v-if='typeof missionPasswords[mission.guid] === "string"'
                                        class='d-flex flex-column flex-lg-row align-items-start gap-2'
                                    >
                                        <TablerInput
                                            v-model='missionPasswords[mission.guid]'
                                            type='password'
                                            placeholder='Password'
                                            :error='errors[mission.guid]'
                                            class='flex-grow-1 w-100'
                                            @keyup.enter='openMission(mission, true)'
                                        />

                                        <button
                                            class='btn btn-primary px-3'
                                            type='button'
                                            @click.stop='openMission(mission, true)'
                                        >
                                            Unlock
                                        </button>
                                    </div>
                                    <div
                                        v-else
                                        class='text-secondary small d-flex flex-wrap align-items-center gap-2'
                                    >
                                        <span
                                            v-text='mission.createTime.replace(/T.*/, "")'
                                        />
                                        <span class='text-white-50'>•</span>
                                        <span
                                            v-text='mission.contents.length + " Items"'
                                        />
                                    </div>
                                </div>

                                <div class='d-flex align-items-center gap-2'>
                                    <IconAccessPoint
                                        v-if='subscribed.has(mission.guid)'
                                        v-tooltip='"Subscribed"'
                                        :size='ICON_SIZE'
                                        stroke='1'
                                        class='text-success'
                                    />
                                </div>
                            </article>
                        </div>
                    </template>
                </template>
            </div>
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
import { ref, onMounted, watch } from 'vue';
import MissionCreate from './Mission/MissionCreate.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useRouter } from 'vue-router';
import {
    TablerIconButton,
    TablerRefreshButton,
    TablerInput,
    TablerNone,
    TablerAlert,
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler';
import type { Mission } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import {
    IconPlus,
    IconLock,
    IconLockOpen,
    IconAccessPoint,
} from '@tabler/icons-vue';
import ChannelInfo from '../util/ChannelInfo.vue';
import { useMapStore } from '../../../stores/map.ts';
import EmptyInfo from '../util/EmptyInfo.vue';
import Subscription from '../../../base/subscription.ts';

const mapStore = useMapStore();
const ICON_SIZE = 24;

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
    await generateFilteredList()
});

const subscribed = ref<Set<string>>(new Set())
const filteredList = ref<Array<Mission>>([]);

watch(paging.value, async () => {
    generateFilteredList();
});

async function generateFilteredList() {
    const filtered = [];

    const subs = await Subscription.localList({
        subscribed: true
    });

    for (const sub of subs) {
        subscribed.value.add(sub.guid);
    }

    for (const mission of list.value) {
        if (!mission.name.toLowerCase().includes(paging.value.filter.toLowerCase())) {
            continue;
        }
        filtered.push(mission);
    }

    filtered.sort((a) => {
        return !subscribed.value.has(a.guid) ? 1 : -1;
    })

    filteredList.value = filtered;
}

async function openMission(mission: Mission, usePassword: boolean) {
    if (mission.passwordProtected && subscribed.value.has(mission.guid)) {
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

function missionKeywords(mission: Mission): string[] {
    if (!Array.isArray(mission.keywords)) return [];
    return mission.keywords
        .map((keyword) => typeof keyword === 'string' ? keyword.trim() : '')
        .filter((keyword): keyword is string => keyword.length > 0);
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
