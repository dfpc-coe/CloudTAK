<template>
    <MenuTemplate name='Contacts'>
        <template #buttons>
            <IconSearch
                v-if='contacts.length'
                v-tooltip='"Search"'
                size='32'
                class='cursor-pointer'
                @click='search.shown = !search.shown'
            />
            <IconRefresh
                v-if='!loading'
                v-tooltip='"Refresh"'
                size='32'
                class='cursor-pointer'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div
                v-if='search.shown'
                class='col-12 px-3'
            >
                <TablerInput
                    v-model='search.filter'
                    placeholder='Filter'
                />
            </div>

            <NoChannelsInfo v-if='hasNoChannels' />

            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!visibleContacts.length'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='a of visibleContacts'
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
import { std, stdurl } from '/src/std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Contact from '../partial/Contact.vue';
import NoChannelsInfo from '../util/NoChannelsInfo.vue';
import {
    IconRefresh,
    IconSearch,
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
        IconSearch,
        MenuTemplate
    },
    data: function() {
        return {
            err: false,
            loading: true,
            contacts: [],
            search: {
                shown: false,
                filter: ''
            }
        }
    },
    computed: {
        ...mapGetters(useProfileStore, ['hasNoChannels']),
        visibleContacts: function() {
            return this.contacts.filter((contact) => {
                return contact.callsign;
            }).filter((contact) => {
                if (this.search.shown) return contact.callsign.includes(this.search.filter);
                return true;
            })
        }
    },
    watch: {
        'search.shown': function() {
            if (!this.search.shown) this.search.filter = '';
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
