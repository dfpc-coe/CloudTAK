<template>
<div class='row'>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <CircleArrowLeftIcon @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Contacts</div>
            <div class='btn-list'>
                <RefreshIcon v-if='!loading' @click='fetchList' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div class='row py-2 px-2'>
        <TablerLoading v-if='loading'/>
        <TablerNone v-else-if='!contacts.length' :create='false'/>
        <template v-else>
            <div :key='a.id' v-for='a in contacts' class="col-lg-12">
                <div class='col-12 py-2 px-2 d-flex align-items-center'>
                    <span class="mx-2 cursor-pointer" v-text='a.notes'></span>
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
    RefreshIcon,
    CircleArrowLeftIcon
} from 'vue-tabler-icons';

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
        RefreshIcon,
        CircleArrowLeftIcon,
    }
}
</script>
