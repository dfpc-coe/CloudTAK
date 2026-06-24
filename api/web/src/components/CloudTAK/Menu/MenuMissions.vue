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
                :loading='tab === "available" ? loading : subscribedLoading'
                @click='refresh'
            />
        </template>
        <template #default>
            <div class='d-flex flex-column'>
                <TablerPillGroup
                    v-model='tab'
                    class='pt-2'
                    :options='[
                        { value: "subscribed", label: "Subscribed" },
                        { value: "available", label: "Available" },
                    ]'
                />

                <SearchSortFilter
                    v-model='paging.filter'
                    v-model:sort='sort'
                    class='pt-2'
                    :sort-options='tab === "available" ? sortOptions : []'
                    :active-filters='activeFilterCount'
                    placeholder='Filter data syncs'
                >
                    <template #sort-icon>
                        <template v-if='sort'>
                            <component
                                :is='sortTypeIcon'
                                :size='20'
                                stroke='1'
                            />
                            <component
                                :is='sortDirectionIcon'
                                :size='20'
                                stroke='1'
                            />
                        </template>
                        <IconArrowsSort
                            v-else
                            :size='20'
                            stroke='1'
                        />
                    </template>
                    <template #filters>
                        <div class='d-flex flex-column'>
                            <div class='d-flex align-items-center justify-content-between px-3 py-2'>
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
                </SearchSortFilter>

                <ChannelInfo />

                <EmptyInfo v-if='mapStore.hasNoChannels' />

                <template v-if='tab === "available"'>
                    <TablerAlert
                        v-if='error'
                        :err='error'
                    />
                    <template v-else>
                        <TablerNone
                            v-if='!loading && !filteredList.length'
                            :create='false'
                            label='No data syncs match your filter'
                        />
                        <TablerLoading v-if='loading' />
                        <div
                            v-if='filteredList.length && !loading'
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

                <template v-else>
                    <TablerAlert
                        v-if='subscribedError'
                        :err='subscribedError'
                    />
                    <template v-else>
                        <TablerNone
                            v-if='!filteredList.length'
                            :create='false'
                            label='No subscribed data syncs'
                        />
                        <div
                            v-if='filteredList.length'
                            class='d-flex flex-column gap-3'
                        >
                            <StandardItem
                                v-for='(mission, mission_it) in filteredList'
                                :key='mission_it'
                                class='d-flex flex-row gap-3 position-relative'
                                @click='openMission(mission, false)'
                            >
                                <div class='flex-grow-1 d-flex flex-column gap-2 py-2 ps-2'>
                                    <div class='d-flex flex-wrap align-items-center gap-2'>
                                        <span
                                            class='fw-semibold text-break'
                                            v-text='mission.name'
                                        />
                                    </div>

                                    <Keywords :keywords='missionKeywords(mission)' />

                                    <div class='text-secondary small d-flex flex-wrap align-items-center gap-2'>
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
import SearchSortFilter from '../util/SearchSortFilter.vue';
import { useRouter } from 'vue-router';
import {
    TablerIconButton,
    TablerRefreshButton,
    TablerNone,
    TablerAlert,
    TablerModal,
    TablerLoading,
    TablerPillGroup,
} from '@tak-ps/vue-tabler';
import type { Mission, MissionInvite } from '../../../types.ts';
import { server } from '../../../std.ts';
import {
    IconPlus,
    IconLock,
    IconLockOpen,
    IconAccessPoint,
    IconLetterCase,
    IconClock,
    IconArrowUp,
    IconArrowDown,
    IconArrowsSort,
} from '@tabler/icons-vue';
import ChannelInfo from '../util/ChannelInfo.vue';
import { useMapStore } from '../../../stores/map.ts';
import EmptyInfo from '../util/EmptyInfo.vue';
import Subscription from '../../../base/subscription.ts';
import OverlayManager from '../../../base/overlay.ts';
import { db } from '../../../database.ts';

const mapStore = useMapStore();

const error = ref<Error | undefined>();
const subscribedError = ref<Error | undefined>();
const create = ref(false)
const loading = ref(true)
const subscribedLoading = ref(false)
const missionPasswords = ref<Record<string, string>>({});
const errors = ref<Record<string, string | undefined>>({})
const router = useRouter();

const paging = ref({ filter: '' });
const list = ref<Array<Mission>>([]);
const invites = ref<MissionInvite[]>([]);
const selectedChannels = ref<string[]>([]);
const selectedKeywords = ref<string[]>([]);
const tab = ref<'subscribed' | 'available'>('subscribed');
const sort = ref('');
const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'A → Z', 'Z → A'];

const sortTypeIcon = computed(() => (sort.value === 'A → Z' || sort.value === 'Z → A') ? IconLetterCase : IconClock);
const sortDirectionIcon = computed(() => (sort.value === 'Oldest → Newest' || sort.value === 'A → Z') ? IconArrowUp : IconArrowDown);

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
    await loadFromLocalDB();
    if (tab.value === 'available') await fetchMissions();
});

const subscribed = ref<Set<string>>(new Set())
const filteredList = ref<Array<Mission>>([]);

watch(paging.value, async () => {
    await generateFilteredList();
});

watch(sort, async () => {
    await generateFilteredList();
});

watch(tab, async () => {
    if (tab.value === 'subscribed') sort.value = '';
    if (tab.value === 'available') {
        await fetchMissions();
    } else {
        await generateFilteredList();
    }
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
        const isSub = subscribed.value.has(mission.guid);

        if (tab.value === 'subscribed' && !isSub) continue;
        if (tab.value === 'available' && isSub) continue;

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

    if (tab.value === 'available') {
        filtered.sort((a, b) => {
            if (sort.value === 'Newest → Oldest') {
                return new Date(b.createTime).getTime() - new Date(a.createTime).getTime();
            } else if (sort.value === 'Oldest → Newest') {
                return new Date(a.createTime).getTime() - new Date(b.createTime).getTime();
            } else if (sort.value === 'A → Z') {
                return a.name.localeCompare(b.name);
            } else if (sort.value === 'Z → A') {
                return b.name.localeCompare(a.name);
            }
            return 0;
        });
    }

    filteredList.value = filtered;
}

async function openMission(mission: Mission, usePassword: boolean) {
    if (subscribed.value.has(mission.guid)) {
        const o = OverlayManager.loadedByMode('mission', mission.guid);
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
            errors.value[mission.guid] = err instanceof Error && err.message.includes('Illegal attempt to access mission')
                ? 'Invalid Password'
                : err instanceof Error ? err.message : String(err);
        }
    } else if (mission.passwordProtected) {
        missionPasswords.value[mission.guid] = '';
    } else {
        router.push(`/menu/missions/${mission.guid}`);
    }
}

async function fetchMission(mission: Mission, password?: string): Promise<Mission> {
    const { data, error } = await server.GET('/api/marti/missions/{:name}', {
        params: {
            path: {
                ':name': mission.guid
            },
            query: {
                password,
                changes: false,
                logs: false,
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

async function loadFromLocalDB() {
    subscribedLoading.value = true;
    subscribedError.value = undefined;

    try {
        const subs = await db.subscription
            .filter((sub) => sub.subscribed === true)
            .toArray();

        for (const sub of subs) {
            subscribed.value.add(sub.guid);
        }

        if (subs.length === 0) tab.value = 'available';

        list.value = subs.map((sub) => sub.meta);
        await generateFilteredList();
    } catch (err) {
        subscribedError.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        subscribedLoading.value = false;
    }
}

async function refresh() {
    if (tab.value === 'available') {
        await fetchMissions();
    } else {
        await loadFromLocalDB();
    }
}

async function fetchMissions() {
    if (tab.value !== 'available') return;
    error.value = undefined;
    loading.value = true;

    try {
        const res = await Subscription.list();
        list.value = res.items;
        invites.value = res.invites;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    await generateFilteredList();
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
