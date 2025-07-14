<template>
    <MenuTemplate name='Chats'>
        <template #buttons>
            <TablerIconButton
                title='New Chat'
                @click='$router.push("/menu/contacts")'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading v-else-if='loading' />
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
                        class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover'
                        @click='$router.push(`/menu/chats/${chat.chatroom}`)'
                    >
                        <IconUser
                            :size='32'
                            stroke='1'
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

<script setup>
import { ref, onMounted } from 'vue'
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconUser,
    IconPlus,
} from '@tabler/icons-vue';

const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const chats = ref({
    total: 0,
    items: []
});

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;

    try {
        const url = stdurl('/api/profile/chat');
        chats.value = await std(url);
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(err);
    }

    loading.value = false;
}
</script>
