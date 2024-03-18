<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Contacts</div>
            <div class='btn-list'>
                <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <TablerLoading v-if='loading'/>
    <TablerNone v-else-if='!contacts.length' :create='false'/>
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
    TablerLoading
} from '@tak-ps/vue-tabler';
import Contact from '../partial/Contact.vue';
import {
    IconRefresh,
    IconCircleFilled,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'Contacts',
    data: function() {
        return {
            err: false,
            loading: true,
            contacts: []
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    computed: {
        visibleContacts: function() {
            return this.contacts.filter((contact) => {
                return contact.callsign;
            });
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
        TablerLoading,
        IconRefresh,
        IconCircleFilled,
        IconCircleArrowLeft,
    }
}
</script>
