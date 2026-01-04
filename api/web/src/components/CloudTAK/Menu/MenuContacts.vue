<template>
    <MenuTemplate name='Contacts'>
        <template #buttons>
            <TablerRefreshButton
                :loading='loading || refresh'
                @click='refreshList'
            />
        </template>
        <template #default>
            <div
                v-if='!loading'
                class='col-12 px-2 py-2'
            >
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <EmptyInfo v-if='mapStore.hasNoChannels' />

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                title='Contacts Error'
                :err='error'
            />
            <TablerNone
                v-else-if='!visibleActiveContacts.length && !visibleOfflineContacts.length'
                label='Contacts Found'
                :create='false'
            />
            <template v-else>
                <label class='subheader mx-2'>Online</label>
                <TablerNone
                    v-if='visibleActiveContacts.length === 0'
                    label='Online Contacts'
                    :compact='true'
                    :create='false'
                />
                <template v-else>
                    <div
                        v-for='team of teams.values()'
                        :key='team'
                        class='col-lg-12'
                    >
                        <SlideDownHeader
                            :model-value='opened.has(team)'
                            :label='config.groups[team] ? config.groups[team] : team'
                            @update:model-value='val => val ? opened.add(team) : opened.delete(team)'
                        >
                            <template #icon>
                                <ContactPuck
                                    class='mx-2'
                                    :size='20'
                                    :team='team'
                                />
                            </template>

                            <template #right>
                                <span class='badge rounded-pill small bg-secondary-subtle text-secondary-emphasis border border-secondary border-opacity-50 ms-auto'>{{ visibleActiveContacts.filter(c => c.team === team).length }}</span>
                            </template>

                            <div class='mx-2 pt-2'>
                                <div
                                    v-for='contact of visibleActiveContacts.values()'
                                    :key='contact.uid'
                                    class='col-lg-12'
                                >
                                    <Contact
                                        v-if='contact.team === team'
                                        :contact='contact'
                                        @chat='router.push(`/menu/chats/new?callsign=${$event.callsign}&uid=${$event.uid}`)'
                                    />
                                </div>
                            </div>
                        </SlideDownHeader>
                    </div>
                </template>

                <div class='col-lg-12'>
                    <SlideDownHeader
                        v-model='showOffline'
                        label='Recently Offline'
                    >
                        <template #right>
                            <span class='badge rounded-pill small bg-secondary-subtle text-secondary-emphasis border border-secondary border-opacity-50 ms-auto'>{{ visibleOfflineContacts.length }}</span>
                        </template>

                        <div class='mx-2 pt-2'>
                            <TablerNone
                                v-if='visibleOfflineContacts.length === 0'
                                label='Offline Contacts'
                                :compact='true'
                                :create='false'
                            />
                            <template v-else>
                                <div
                                    v-for='a of visibleOfflineContacts'
                                    :key='a.uid'
                                    class='col-lg-12'
                                >
                                    <Contact
                                        :contact='a'
                                        :button-chat='false'
                                    />
                                </div>
                            </template>
                        </div>
                    </SlideDownHeader>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import type { Ref } from 'vue';
import { std } from '../../../std.ts';
import type { ContactList, ConfigGroups } from '../../../types.ts';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();
import MenuTemplate from '../util/MenuTemplate.vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import Contact from '../util/Contact.vue';
import ContactPuck from '../util/ContactPuck.vue';
import EmptyInfo from '../util/EmptyInfo.vue';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';

const router = useRouter();
const error = ref<Error | undefined>();
const loading = ref(true);
const refresh = ref(false);
const contacts = ref<ContactList>([])
const showOffline = ref(false);
const paging = ref({
    filter: ''
});

const config = ref<ConfigGroups>({
    groups: {},
    roles: []
});

const opened = ref<Set<string>>(new Set());
const teams = ref<Set<string>>(new Set());

const self = ref<string>('');
const visibleActiveContacts = ref<ContactList>([]);
const visibleOfflineContacts = ref<ContactList>([]);

const channel = new BroadcastChannel("cloudtak");

channel.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === WorkerMessageType.Contact_Change) {
        await fetchList(refresh);
        await updateContacts();
    }
}

onMounted(async () => {
    self.value = await mapStore.worker.profile.uid();

    await Promise.all([
        fetchList(loading),
        fetchConfig()
    ]);

    await updateContacts();
});

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
    }
})

watch(paging.value, async () => {
    await updateContacts();
});

async function fetchConfig() {
    config.value = await std('/api/config/group') as ConfigGroups;
}

async function updateContacts() {
    const newOpened = new Set<string>();
    const newTeams = new Set<string>();
    const newVisibleActive: ContactList = [];
    const newVisibleOffline: ContactList = [];

    for (const contact of contacts.value) {
        if (!contact.callsign.toLowerCase().includes(paging.value.filter.toLowerCase())) continue;
        if (contact.uid === self.value) continue;

        if (await mapStore.worker.db.has(contact.uid)) {
            if (contact.team) {
                newTeams.add(contact.team);
                newOpened.add(contact.team);
            }

            newVisibleActive.push(contact);
        } else {
            newVisibleOffline.push(contact);
        }
    }

    opened.value = newOpened;
    teams.value = newTeams;
    visibleActiveContacts.value = newVisibleActive;
    visibleOfflineContacts.value = newVisibleOffline;
}

async function fetchList(loading: Ref<boolean>) {
    loading.value = true;

    try {
        const team = await mapStore.worker.team.load();
        contacts.value = Array.from(team.values())
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err))
    }

    loading.value = false;
}

async function refreshList() {
    await fetchList(refresh);
    await updateContacts();
}
</script>
