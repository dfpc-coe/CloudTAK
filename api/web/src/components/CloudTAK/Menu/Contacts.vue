<template>
    <MenuTemplate name='Contacts'>
        <template #buttons>
            <TablerIconButton
                v-if='!loading'
                icon='IconRefresh'
                title='Refresh'
                @click='fetchList'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
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

            <EmptyInfo v-if='hasNoChannels' />

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                title='Contacts Error'
                :err='error'
            />
            <TablerNone
                v-else-if='!visibleActiveContacts.length && !visibleOfflineContacts'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='a of visibleActiveContacts'
                    :key='a.uid'
                    class='col-lg-12'
                >
                    <Contact
                        :contact='a'
                        @chat='$router.push(`/menu/chats/new?callsign=${$event.callsign}&uid=${$event.uid}`)'
                    />
                </div>

                <label class='subheader mx-2'>Recently Offline</label>
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
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import type { ContactList } from '../../../types.ts';
import { useProfileStore } from '../../../stores/profile.ts';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconRefresh
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import Contact from '../util/Contact.vue';
import EmptyInfo from '../util/EmptyInfo.vue';

const profileStore = useProfileStore();
const error = ref<Error | undefined>();
const loading = ref(true);
const contacts = ref<ContactList>([])
const paging = ref({
    filter: ''
});

const hasNoChannels = profileStore.hasNoChannels;

const visibleActiveContacts = computed(() => {
    return contacts.value.filter((contact) => {
        return contact.callsign;
    }).filter((contact) => {
        return cotStore.cots.has(contact.uid);
    }).filter((contact) => {
        return contact.callsign.toLowerCase().includes(paging.value.filter.toLowerCase());
    })
});

const visibleOfflineContacts = computed(() => {
    return contacts.value.filter((contact) => {
        return contact.callsign;
    }).filter((contact) => {
        return !cotStore.cots.has(contact.uid);
    }).filter((contact) => {
        return contact.callsign.toLowerCase().includes(paging.value.filter.toLowerCase());
    })
})

onMounted(async () => {
    await fetchList();
});


async function fetchList() {
    loading.value = true;

    try {
        const url = stdurl('/api/marti/api/contacts/all');
        contacts.value = await std(url) as ContactList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err))
    }

    loading.value = false;
}
</script>
