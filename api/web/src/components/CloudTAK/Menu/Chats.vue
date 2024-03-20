<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Chats</div>
            <div class='btn-list'>
                <IconPlus @click='$router.push("/menu/contacts")' size='32' class='cursor-pointer' v-tooltip='"New Chat"'/>
                <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div class='py-2 px-2'>
        <TablerLoading v-if='loading'/>
        <TablerNone v-else-if='!chats.items.length' :create='false'/>
        <template v-else>
            <pre v-text='chats.items'/>
        </template>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';

import {
    IconCircleArrowLeft,
    IconPlus,
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
            const url = stdurl('/api/profile/chat');
            this.chats = await std(url);
            this.loading = false;
        },
    },
    components: {
        IconPlus,
        IconRefresh,
        TablerNone,
        TablerLoading,
        IconCircleArrowLeft,
    }
}
</script>
