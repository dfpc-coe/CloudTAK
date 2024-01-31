<template>
<div class='row'>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Chats</div>
            <div class='btn-list'>
                <IconRefresh v-if='!loading' @click='fetchList' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div class='row py-2 px-2'>
        <TablerLoading v-if='loading'/>
        <TablerNone v-else-if='!chats.items.length' :create='false'/>
        <template v-else>
            <pre v-text='chats.items'/>
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
    IconCircleArrowLeft,
    IconRefresh,
} from '@tabler/icons-vue';

export default {
    name: 'Chats',
    data: function() {
        return {
            err: false,
            loading: true,
            chats: []
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/profile/chat');
            this.chats = await window.std(url);
            this.loading = false;
        },
    },
    components: {
        IconRefresh,
        TablerNone,
        TablerLoading,
        IconCircleArrowLeft,
    }
}
</script>
