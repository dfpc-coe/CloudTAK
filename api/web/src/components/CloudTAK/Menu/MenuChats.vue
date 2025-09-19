<template>
    <MenuTemplate name='Chats'>
        <template #buttons>
            <TablerIconButton
                title='Select Chats'
                @click='multiselect = !multiselect'
            >
                <IconListCheck
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                title='New Chat'
                @click='router.push("/menu/contacts")'
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
                <GenericSelect
                    role='menu'
                    :disabled='!multiselect'
                    :items='chats.items'
                >
                    <template #item="{item}">
                        <div
                            role='menuitem'
                            tabindex='0'
                            :class='{
                                "hover cursor-pointer": !multiselect
                            }'
                            class='col-12 py-2 px-3 d-flex align-items-center'
                            @click='multiselect ? undefined : router.push(`/menu/chats/${item.chatroom}`)'
                        >
                            <IconUser
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-2'
                                style='font-size: 18px;'
                                v-text='item.chatroom'
                            />
                        </div>
                    </template>
                </GenericSelect>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { std, stdurl } from '/src/std.ts';
import GenericSelect from '../util/GenericSelect.vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconListCheck,
    IconUser,
    IconPlus,
} from '@tabler/icons-vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const multiselect = ref(false)
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
