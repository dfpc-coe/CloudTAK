<template>
    <MenuTemplate name='Chats'>
        <template #buttons>
            <IconPlus
                v-tooltip='"New Chat"'
                :size='32' 
                :stroke='1' 
                role='button'
                tabindex='0'
                class='cursor-pointer'
                @click='$router.push("/menu/contacts")'
            />
            <IconRefresh
                v-if='!loading'
                v-tooltip='"Refresh"'
                :size='32' 
                :stroke='1' 
                role='button'
                tabindex='0'
                class='cursor-pointer'
                @click='fetchList'
            />
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!chats.items.length'
                :create='false'
            />
            <template v-else>
                <div
                    class='col-12'
                    role='menu'
                >
                    <div
                        v-for='chat in chats.items'
                        role='menuitem'
                        tabindex='0'
                        class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'
                        @click='$router.push(`/menu/chats/${chat.chatroom}`)'
                    >
                        <IconUser 
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            class='mx-2'
                            style='font-size: 18px;'
                            v-text='chat.chatroom'
                        />
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconUser,
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKChats',
    components: {
        IconPlus,
        IconRefresh,
        IconUser,
        TablerNone,
        TablerLoading,
        MenuTemplate
    },
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
    }
}
</script>
