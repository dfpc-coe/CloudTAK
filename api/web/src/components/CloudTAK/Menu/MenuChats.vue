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
            <div class='col-12 px-2 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!filteredChats.length'
                :create='false'
            />
            <template v-else>
                <GenericSelect
                    ref='select'
                    role='menu'
                    :disabled='!multiselect'
                    :items='filteredChats'
                >
                    <template #buttons="{disabled}">
                        <TablerDelete
                            :disabled='disabled'
                            displaytype='icon'
                            @delete='deleteChats'
                        />
                    </template>
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

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue'
import { server } from '../../../std.ts';
import type { ProfileChatroomList } from '../../../types.ts';
import GenericSelect from '../util/GenericSelect.vue';
import {
    TablerNone,
    TablerAlert,
    TablerDelete,
    TablerInput,
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

const select = ref<GenericSelect | null>(null);
const router = useRouter();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const multiselect = ref(false)

const chats = ref<ProfileChatroomList>({
    total: 0,
    items: []
});

const paging = ref({
    filter: ''
});

onMounted(async () => {
    await fetchList();
});

const filteredChats = computed(() => {
    if (!paging.value.filter) return chats.value.items;

    return chats.value.items.filter(c =>
        c.chatroom.toLowerCase().includes(paging.value.filter.toLowerCase())
    ).sort().reverse();
});

async function deleteChats(): Promise<void> {
    console.log('Deleting chats');
    const selected = select.value.selected;

    loading.value = true;

    const res = await server.DELETE('/api/profile/chat', {
        params: {
            query: {
                chatroom: Array.from(selected.values())
            }
        }
    });

    if (res.error) {
        loading.value = false;
        error.value = Error(res.error.message);
        return;
    }

    await fetchList();
}

async function fetchList(): Promise<void> {
    loading.value = true;
    multiselect.value = false;
    error.value = undefined;

    const res = await server.GET('/api/profile/chat');
    loading.value = false;

    loading.value = false;
    if (res.error) error.value = Error(res.error.message);

    chats.value = res.data;
}
</script>
