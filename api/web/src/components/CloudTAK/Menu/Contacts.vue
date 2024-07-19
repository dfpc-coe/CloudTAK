<template>
    <MenuTemplate name='Contacts'>
        <template #buttons>
            <IconRefresh
                v-if='!loading'
                v-tooltip='"Refresh"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div
                v-if='!loading'
                class='col-12 px-2 pb-2'
            >
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <NoChannelsInfo v-if='hasNoChannels' />

            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!visibleActiveContacts.length && !visibleOfflineContacts'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='a of visibleActiveContacts'
                    :key='a.id'
                    class='col-lg-12'
                >
                    <Contact
                        :contact='a'
                        @chat='$router.push(`/menu/chats/${$event}`)'
                    />
                </div>

                <label class='subheader mx-2'>Recently Offline</label>
                <div
                    v-for='a of visibleOfflineContacts'
                    :key='a.id'
                    class='col-lg-12'
                >
                    <Contact
                        :contact='a'
                        @chat='$router.push(`/menu/chats/${$event}`)'
                    />
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import { mapGetters } from 'pinia'
import { useProfileStore } from '/src/stores/profile.ts';
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();
import { std, stdurl } from '/src/std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Contact from '../util/Contact.vue';
import NoChannelsInfo from '../util/NoChannelsInfo.vue';
import {
    IconRefresh,
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKContacts',
    components: {
        Contact,
        TablerNone,
        NoChannelsInfo,
        TablerInput,
        TablerLoading,
        IconRefresh,
        MenuTemplate
    },
    data: function() {
        return {
            err: false,
            loading: true,
            contacts: [],
            paging: {
                filter: ''
            }
        }
    },
    computed: {
        ...mapGetters(useProfileStore, ['hasNoChannels']),
        visibleActiveContacts: function() {
            return this.contacts.filter((contact) => {
                return contact.callsign;
            }).filter((contact) => {
                return cotStore.cots.has(contact.uid);
            }).filter((contact) => {
                return contact.callsign.toLowerCase().includes(this.paging.filter.toLowerCase());
            })
        },
        visibleOfflineContacts: function() {
            return this.contacts.filter((contact) => {
                return contact.callsign;
            }).filter((contact) => {
                return !cotStore.cots.has(contact.uid);
            }).filter((contact) => {
                return contact.callsign.toLowerCase().includes(this.paging.filter.toLowerCase());
            })
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/marti/api/contacts/all');
            this.contacts = await std(url);
            this.loading = false;
        },
    }
}
</script>
