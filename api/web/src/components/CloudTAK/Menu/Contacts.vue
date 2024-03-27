<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Contacts</div>
            <div class='btn-list'>
                <IconSearch v-if='contacts.length' @click='search.shown = !search.shown' v-tooltip='"Search"' size='32' class='cursor-pointer'/>
                <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div v-if='search.shown' class='col-12 px-3'>
        <TablerInput v-model='search.filter' placeholder='Filter'/>
    </div>

    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!visibleContacts.length' :create='false'/>
    <template v-else>
        <div :key='a.id' v-for='a of visibleContacts' class="col-lg-12">
            <Contact @chat='$router.push(`/menu/chats/${$event}`)' :contact='a'/>
        </div>
    </template>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Contact from '../partial/Contact.vue';
import {
    IconRefresh,
    IconSearch,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKContacts',
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
    mounted: async function() {
        await this.fetchList();
    },
    watch: {
        'search.shown': function() {
            if (!this.search.shown) this.search.filter = '';
        }
    },
    computed: {
        visibleContacts: function() {
            return this.contacts.filter((contact) => {
                return contact.callsign;
            }).filter((contact) => {
                if (this.search.shown) return contact.callsign.includes(this.search.filter);
                return true;
            })
        }
    },
    methods: {
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/marti/api/contacts/all');
            this.contacts = await std(url);
            this.loading = false;
        },
    },
    components: {
        Contact,
        TablerNone,
        TablerInput,
        TablerLoading,
        IconRefresh,
        IconSearch,
        IconCircleArrowLeft,
    }
}
</script>
