<template>
    <MenuTemplate name='Contacts'>
        <template #buttons>
            <TablerRefreshButton
                :loading='syncing'
                @click='refreshList'
            />
        </template>
        <template #default>
            <div class='col-12 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <EmptyInfo v-if='mapStore.hasNoChannels' />

            <TablerLoading v-if='!contacts' />
            <TablerNone
                v-else-if='!visibleActiveContacts.length && !visibleOfflineContacts.length'
                label='No Contacts'
                :create='false'
            />
            <template v-else>
                <label class='subheader'>Online</label>
                <TablerNone
                    v-if='visibleActiveContacts.length === 0'
                    label='No Online Contacts'
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
                            :label='groups[team] || team'
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
                                <TablerBadge
                                    class='rounded-pill small ms-auto'
                                    background-color='rgba(107, 114, 128, 0.15)'
                                    border-color='rgba(107, 114, 128, 0.3)'
                                    text-color='#6b7280'
                                >
                                    {{ visibleActiveContacts.filter(c => c.team === team).length }}
                                </TablerBadge>
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
                            <TablerBadge
                                class='rounded-pill small ms-auto'
                                background-color='rgba(107, 114, 128, 0.15)'
                                border-color='rgba(107, 114, 128, 0.3)'
                                text-color='#6b7280'
                            >
                                {{ visibleOfflineContacts.length }}
                            </TablerBadge>
                        </template>

                        <div class='mx-2 pt-2'>
                            <TablerNone
                                v-if='visibleOfflineContacts.length === 0'
                                label='No Offline Contacts'
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
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { Ref } from 'vue';
import { liveQuery } from 'dexie';
import { useObservable } from '@vueuse/rxjs';
import { from } from 'rxjs';
import Config from '../../../base/config.ts';
import type { FullConfig } from '../../../base/config.ts';
import ContactManager from '../../../base/contact.ts';
import type { Contact as ContactType, ContactList } from '../../../types.ts';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();
import MenuTemplate from '../util/MenuTemplate.vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import {
    TablerBadge,
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import Contact from '../util/Contact.vue';
import ContactPuck from '../util/ContactPuck.vue';
import EmptyInfo from '../util/EmptyInfo.vue';

const router = useRouter();
const syncing = ref(false);
const showOffline = ref(false);
const paging = ref({
    filter: ''
});

const groups = ref<Record<string, string>>({});

const opened = ref<Set<string>>(new Set());
const teams = ref<Set<string>>(new Set());

const self = ref<string>('');
const visibleActiveContacts = ref<ContactList>([]);
const visibleOfflineContacts = ref<ContactList>([]);

const contacts: Ref<ContactType[] | undefined> = useObservable(
    from(liveQuery(async () => {
        return await ContactManager.list();
    }))
);

onMounted(async () => {
    self.value = await mapStore.worker.profile.uid();
    await fetchConfig();
});

watch([contacts, paging.value], async () => {
    await updateContacts();
});

const groupKeys: (keyof FullConfig)[] = [
    'group::Yellow',
    'group::Cyan',
    'group::Green',
    'group::Red',
    'group::Purple',
    'group::Orange',
    'group::Blue',
    'group::Magenta',
    'group::White',
    'group::Maroon',
    'group::Dark Blue',
    'group::Teal',
    'group::Dark Green',
    'group::Brown',
];

async function fetchConfig() {
    const config = await Config.list(groupKeys);
    const result: Record<string, string> = {};
    for (const key of groupKeys) {
        const val = config[key];
        if (val) result[key.replace('group::', '')] = String(val);
    }
    groups.value = result;
}

async function updateContacts() {
    if (!contacts.value) return;

    const filter = paging.value.filter.toLowerCase();
    const newOpened = new Set<string>();
    const newTeams = new Set<string>();
    const newVisibleActive: ContactList = [];
    const newVisibleOffline: ContactList = [];

    for (const contact of contacts.value) {
        if (filter && !contact.callsign.toLowerCase().includes(filter)) continue;
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

async function refreshList() {
    syncing.value = true;
    try {
        await ContactManager.sync();
    } finally {
        syncing.value = false;
    }
}
</script>
