<template>
<div class='row'>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Contacts</div>
            <div class='btn-list'>
                <IconRefresh v-if='!loading' @click='fetchList' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div class='row py-2 px-2'>
        <TablerLoading v-if='loading'/>
        <TablerNone v-else-if='!contacts.length' :create='false'/>
        <template v-else>
            <div :key='a.id' v-for='a of visibleContacts' class="col-lg-12">
                <div class='col-12 row py-2 px-2 d-flex align-items-center hover-dark cursor-pointer'>
                    <div class='col-auto'>
                        <IconCircleFilled :class='{
                            "text-yellow": a.team === "Yellow",
                            "text-cyan": a.team === "Cyan",
                            "text-lime": a.team === "Green",
                            "text-red": a.team === "Red",
                            "text-purple": a.team === "Purple",
                            "text-orange": a.team === "Orange",
                            "text-azure": a.team === "Blue",
                            "text-dribble": a.team === "Magenta",
                            "text-white": a.team === "White",
                            "text-pinterest": a.team === "Maroon",
                            "text-blue": a.team === "Dark Blue",
                            "text-teal": a.team === "Teal",
                            "text-green": a.team === "Dark Green",
                            "text-google": a.team === "Brown",
                        }'/>
                    </div>
                    <div class='col-auto'>
                        <div v-text='a.callsign'></div>
                        <div v-text='a.notes.trim()' class='subheader'></div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';

import {
    IconRefresh,
    IconCircleFilled,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'Contacts',
    props: {
        map: {
            type: Object,
            required: true
        }
    },
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
            const url = window.stdurl('/api/marti/api/contacts/all');
            this.contacts = await window.std(url);
            this.loading = false;
        },
    },
    components: {
        TablerNone,
        TablerLoading,
        IconRefresh,
        IconCircleFilled,
        IconCircleArrowLeft,
    }
}
</script>
