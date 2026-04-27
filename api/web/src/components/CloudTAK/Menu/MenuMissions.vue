<template>
    <MenuTemplate
        name='Data Syncs'
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
            <TablerRefreshButton
                :loading='loading'
                @click='fetchMissions'
            />
        </template>
        <template #default>
            <div class='d-flex flex-column'>
                <div class='d-flex pt-2 flex-row align-items-sm-center gap-2'>
                    <TablerInput
                        v-model='paging.filter'
                        :autofocus='true'
                        icon='search'
                        placeholder='Filter data syncs'
                        class='flex-grow-1'
                    />
                    <TablerDropdown
                        :width='280'
                        autoclose='outside'
                    >
                        <button
                            type='button'
                            class='btn btn-outline-secondary d-flex align-items-center gap-1 position-relative filter-btn'
                            title='Filter data syncs'
                        >
                            <IconFilter
                                :size='20'
                                stroke='1'
                            />
                            <span
                                v-if='activeFilterCount > 0'
                                class='badge bg-primary ms-1'
                                v-text='activeFilterCount'
                            />
                        </button>
                        <template #dropdown>
                            <div
                                class='filter-dropdown d-flex flex-column'
                                style='max-height: 320px; overflow-y: auto;'
                            >
                                <div class='filter-dropdown__header d-flex align-items-center justify-content-between px-3 py-2'>
                                    <strong class='small text-uppercase text-white-50'>Filters</strong>
                                    <button
                                        v-if='activeFilterCount > 0'
                                        type='button'
                                        class='btn btn-link btn-sm p-0'
                                        @click='clearFilters'
                                    >
                                        Clear
                                    </button>
                                </div>

                                <div class='px-3 pb-2 d-flex flex-column gap-2'>
                                    <div>
                                        <div class='small text-uppercase text-white-50 mb-1'>
                                            Channels
                                        </div>
                                        <div
                                            v-if='!availableChannels.length'
                                            class='small text-secondary'
                                        >
                                            No channels available
                                        </div>
                                        <label
                                            v-for='channel in availableChannels'
                                            :key='"channel-" + channel'
                                            class='form-check mb-1'
                                        >
                                            <input
                                                class='form-check-input'
                                                type='checkbox'
                                                :checked='selectedChannels.includes(channel)'
                                                @change='toggleChannel(channel)'
                                            >
                                            <span
                                                class='form-check-label'
                                                v-text='channel'
                                            />
                                        </label>
                                    </div>

                                    <div>
                                        <div class='small text-uppercase text-white-50 mb-1'>
                                            Keywords
                                        </div>
                                        <div
                                            v-if='!availableKeywords.length'
                                            class='small text-secondary'
                                        >
                                            No keywords available
                                        </div>
                                        <label
                                            v-for='keyword in availableKeywords'
                                            :key='"keyword-" + keyword'
                                            class='form-check mb-1'
                                        >
                                            <input
                                                class='form-check-input'
                                                type='checkbox'
                                                :checked='selectedKeywords.includes(keyword)'
                                                @change='toggleKeyword(keyword)'
                                            >
                                            <span
                                                class='form-check-label'
                                                v-text='keyword'
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </TablerDropdown>
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
                        />
                        <div
                            v-else
                            class='d-flex flex-column gap-3'
                        >
                            <PendingInvites
                                v-model:invites='invites'
                                @open-mission='openMission($event, false)'
                                @error='error = $event'
                            />

                            <StandardItem
                                v-for='(mission, mission_it) in filteredList'
                                :key='mission_it'
                                class='d-flex flex-row gap-3 position-relative'
                                @click='openMission(mission, false)'
                            >
                                <div class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 ms-2 mt-2'>
                                    <IconLock
                                        v-if='mission.passwordProtected'
                                        :size='24'
                                        stroke='1'
                                    />
                                    <IconLockOpen
                                        v-else
                                        :size='24'
                                        stroke='1'
                                    />
                                </div>

                                <div class='flex-grow-1 d-flex flex-column gap-2 py-2'>
                                    <div class='d-flex flex-wrap align-items-center gap-2'>
                                        <span
                                            class='fw-semibold text-break'
                                            v-text='mission.name'
                                        />
                                    </div>

                                    <Keywords :keywords='missionKeywords(mission)' />

                                    <div
                                        v-if='typeof missionPasswords[mission.guid] === "string"'
                                        class='d-flex flex-column mx-2 flex-lg-row align-items-start gap-2'
                                    >
                                        <TablerInput
                                            v-model='missionPasswords[mission.guid]'
                                            type='password'
                                            autocomplete='new-password'
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

                                <div class='d-flex align-items-center gap-2 pe-2'>
                                    <IconAccessPoint
                                        v-if='subscribed.has(mission.guid)'
                                        v-tooltip='"Subscribed"'
                                        class='text-success'
                                        :size='32'
                                        stroke='1'
                                    />
                                </div>
                            </StandardItem>
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
import { ref, computed, onMounted, watch } from 'vue';
import MissionCreate from './Mission/MissionCreate.vue';
import PendingInvites from './Mission/PendingInvites.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import Keywords from '../util/Keywords.vue';
import { useRouter } from 'vue-router';
import {
    TablerIconButton,
    TablerRefreshButton,
    TablerInput,
    TablerNone,
    TablerAlert,
    TablerModal,
    TablerDropdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import type { Mission, MissionInvite } from '../../../types.ts';
import { server } from '../../../std.ts';
import {
    IconPlus,
    IconLock,
    IconLockOpen,
    IconFilter,
    IconAccessPoint
} from '@tabler/icons-vue';
import ChannelInfo from '../util/ChannelInfo.vue';
import { useMapStore } from '../../../stores/map.ts';
import EmptyInfo from '../util/EmptyInfo.vue';
import Subscription from '../../../base/subscription.ts';

const mapStore = useMapStore();

const error = ref<Error | undefined>();
const create = ref(false)
const loading = ref(true)
const missionPasswords = ref<Record<string, string>>({});
const errors = ref<Record<string, string | undefined>>({})
const router = useRouter();

const paging = ref({ filter: '' });
const list = ref<Array<Mission>>([]);
const invites = ref<MissionInvite[]>([]);
const selectedChannels = ref<string[]>([]);
const selectedKeywords = ref<string[]>([]);

function missionGroups(mission: Mission): string[] {
    const groups = mission.groups;
    if (!groups) return [];
    if (Array.isArray(groups)) {
        return groups
            .map((g) => typeof g === 'string' ? g.trim() : '')
            .filter((g): g is string => g.length > 0);
    }
    return typeof groups === 'string' && groups.trim().length
        ? [groups.trim()]
        : [];
}

const availableChannels = computed<string[]>(() => {
    const set = new Set<string>();
    for (const mission of list.value) {
        for (const g of missionGroups(mission)) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
});

const availableKeywords = computed<string[]>(() => {
    const set = new Set<string>();
    for (const mission of list.value) {
        for (const k of missionKeywords(mission)) set.add(k);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
});

const activeFilterCount = computed<number>(() => {
    return selectedChannels.value.length + selectedKeywords.value.length;
});

function toggleChannel(channel: string): void {
    const idx = selectedChannels.value.indexOf(channel);
    if (idx === -1) selectedChannels.value.push(channel);
    else selectedChannels.value.splice(idx, 1);
    generateFilteredList();
}

function toggleKeyword(keyword: string): void {
    const idx = selectedKeywords.value.indexOf(keyword);
    if (idx === -1) selectedKeywords.value.push(keyword);
    else selectedKeywords.value.splice(idx, 1);
    generateFilteredList();
}

function clearFilters(): void {
    selectedChannels.value = [];
    selectedKeywords.value = [];
    generateFilteredList();
}

onMounted(async () => {
    await fetchMissions();
});

const subscribed = ref<Set<string>>(new Set())
const filteredList = ref<Array<Mission>>([]);

watch(paging.value, async () => {
    await generateFilteredList();
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

        if (selectedChannels.value.length) {
            const groups = missionGroups(mission);
            if (!selectedChannels.value.some((c) => groups.includes(c))) {
                continue;
            }
        }

        if (selectedKeywords.value.length) {
            const keywords = missionKeywords(mission);
            if (!selectedKeywords.value.some((k) => keywords.includes(k))) {
                continue;
            }
        }

        filtered.push(mission);
    }

    filtered.sort((a, b) => {
        const aSub = subscribed.value.has(a.guid);
        const bSub = subscribed.value.has(b.guid);

        if (aSub && !bSub) return -1;
        if (!aSub && bSub) return 1;
        return 0;
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
    const { data, error } = await server.GET('/api/marti/missions/{:name}', {
        params: {
            path: {
                ':name': mission.guid
            },
            query: {
                password
            }
        }
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Mission fetch failed');

    return data;
}

function missionKeywords(mission: Mission): string[] {
    if (!Array.isArray(mission.keywords)) return [];
    return mission.keywords
        .map((keyword) => typeof keyword === 'string' ? keyword.trim() : '')
        .filter((keyword): keyword is string => keyword.length > 0)
        .filter((keyword) => !keyword.startsWith('template:'));
}

async function fetchMissions() {
    error.value = undefined;

    try {
        loading.value = true;

        const res = await Subscription.list();
        list.value = res.items;
        invites.value = res.invites;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    await generateFilteredList()

    loading.value = false;
}


</script>

<style scoped>
.filter-btn {
    height: calc(2.25rem + 2px);
}

.filter-dropdown__header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--tabler-dropdown-bg, rgba(20, 20, 25, 0.96));
    border-bottom: 1px solid var(--tabler-dropdown-border-color, rgba(255, 255, 255, 0.1));
}

.icon-wrapper {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    min-height: 3rem;
    flex-shrink: 0;
}

.menu-overlays-fade-enter-active,
.menu-overlays-fade-leave-active {
    transition: all 0.2s ease-out;
    max-height: 500px;
    opacity: 1;
    overflow: hidden;
}

.menu-overlays-fade-enter-from,
.menu-overlays-fade-leave-to {
    max-height: 0;
    opacity: 0;
    margin-top: 0 !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
}
</style>
