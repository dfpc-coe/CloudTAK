<template>
    <MenuTemplate name='Contacts'>
        <template #buttons>
            <TablerRefreshButton
                :loading='loading || refresh'
                @click='fetchList'
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
                        <div
                            class='col-lg-12 d-flex align-items-center cursor-pointer hover'
                            style='height: 40px'
                            @click='opened.has(team) ? opened.delete(team) : opened.add(team)'
                        >
                            <div class='ps-2'>
                                <TablerIconButton
                                    v-if='opened.has(team)'
                                    title='Close Contact Team'
                                >
                                    <IconChevronDown
                                        :size='32'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                                <TablerIconButton
                                    v-else
                                    title='Open Contact Team'
                                >
                                    <IconChevronRight
                                        :size='32'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                            <ContactPuck
                                class='mx-2'
                                :compact='true'
                                :team='team'
                            /> <span v-text='config.groups[team] ? config.groups[team] : team' />
                        </div>
                        <template v-if='opened.has(team)'>
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
                        </template>
                    </div>
                </template>

                <div
                    class='col-lg-12 d-flex align-items-center cursor-pointer hover'
                    style='height: 40px'
                    @click='showOffline = !showOffline'
                >
                    <TablerIconButton
                        v-if='showOffline'
                        title='Hide Offline'
                    >
                        <IconChevronDown
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerIconButton
                        v-else
                        title='Show Offline'
                    >
                        <IconChevronRight
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <label class='subheader mx-2 cursor-pointer'>Recently Offline</label>
                </div>
                <template v-if='showOffline'>
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
                </template>
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
import {
    IconChevronRight,
    IconChevronDown
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerIconButton,
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
    opened.value.clear();
    teams.value.clear();
    visibleActiveContacts.value = [];
    visibleOfflineContacts.value = [];

    for (const contact of contacts.value) {
        if (!contact.callsign.toLowerCase().includes(paging.value.filter.toLowerCase())) continue;
        if (contact.uid === self.value) continue;

        if (await mapStore.worker.db.has(contact.uid)) {
            if (contact.team) {
                teams.value.add(contact.team);
                opened.value.add(contact.team);
            }

            visibleActiveContacts.value.push(contact);
        } else {
            visibleOfflineContacts.value.push(contact);
        }
    }
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
</script>
