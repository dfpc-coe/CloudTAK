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
            <div class='col-12'>
                <div @click='$router.push(`/menu/chats/${chat.chatroom}`)' v-for='chat in chats.items' class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                    <IconUser size='32'/>
                    <span class='mx-2' style='font-size: 18px;' v-text='chat.chatroom'/>
                </div>
            </div>
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
    IconUser,
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKChats',
    data: function() {
        return {
            err: false,
            loading: true,
            chats: {
                total: 0,
                items: []
            }
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
        IconUser,
        TablerNone,
        TablerLoading,
        IconCircleArrowLeft,
    }
}
</script>
