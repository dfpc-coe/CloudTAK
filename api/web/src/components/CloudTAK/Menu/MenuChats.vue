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
            <div class='col-12 py-2'>
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
            <TablerLoading v-else-if='loading || !chats' />
            <TablerNone
                v-else-if='!chats.length'
                :create='false'
            />
            <template v-else>
                <GenericSelect
                    ref='select'
                    role='menu'
                    :disabled='!multiselect'
                    :hover='false'
                    :items='chats'
                >
                    <template #buttons='{disabled}'>
                        <TablerDelete
                            :disabled='disabled'
                            displaytype='icon'
                            @delete='deleteChats'
                        />
                    </template>
                    <template #item='{item}'>
                        <StandardItem
                            class='d-flex align-items-center gap-3 p-2 w-100'
                            @click='multiselect ? undefined : router.push(`/menu/chats/${item.name}`)'
                        >
                            <div
                                class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                                style='width: 3rem; height: 3rem; min-width: 3rem;'
                            >
                                <IconUser
                                    :size='24'
                                    stroke='1'
                                />
                            </div>

                            <div
                                class='d-flex flex-column flex-grow-1'
                                style='min-width: 0'
                            >
                                <div class='d-flex justify-content-between align-items-center w-100'>
                                    <div class='d-flex flex-column text-truncate'>
                                        <span class='fw-bold text-truncate'>{{ item.name }}</span>
                                        <span
                                            class='text-muted text-nowrap'
                                            style='font-size: 0.75rem;'
                                        >
                                            {{ timeDiff(item.updated) }}
                                        </span>
                                    </div>
                                    <div
                                        v-if='item.unread'
                                        class='me-3 flex-shrink-0 d-flex align-items-center justify-content-center rounded-pill border border-danger bg-danger bg-opacity-50 text-white px-2 small'
                                    >
                                        {{ item.unread }}
                                    </div>
                                </div>
                            </div>
                        </StandardItem>
                    </template>
                </GenericSelect>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, useTemplateRef, watch, onUnmounted } from 'vue'
import type { ComponentExposed } from 'vue-component-type-helpers'
import Chatroom from '../../../base/chatroom.ts';
import type { DBChatroom } from '../../../base/database.ts';
import GenericSelect from '../util/GenericSelect.vue';
import StandardItem from '../util/StandardItem.vue';
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
import { liveQuery } from "dexie";
import timeDiff from '../../../timediff.ts';

const select = useTemplateRef<ComponentExposed<typeof GenericSelect>>('select');
const router = useRouter();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const multiselect = ref(false)

const paging = ref({
    filter: ''
});

const chats = ref<Array<DBChatroom> | undefined>(undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let subscription: any;

watch(() => paging.value.filter, (filter) => {
    if (subscription) {
        subscription.unsubscribe();
        subscription = null;
    }

    const obs = liveQuery(async () => {
        return await Chatroom.list(filter);
    });
    
    subscription = obs.subscribe({
        next: (val: Array<DBChatroom>) => {
            chats.value = val;
        },
        error: (err: Error) => {
            console.error(err);
        }
    });
}, { immediate: true });

onUnmounted(() => {
    if (subscription) {
        subscription.unsubscribe();
    }
});

onMounted(async () => {
    await fetchList();
});

async function deleteChats(): Promise<void> {
    if (!select.value) return;
    const selected = select.value.selected;

    loading.value = true;

    const chatroom: Array<string> = Array.from(selected.values()).map(id => String(id));

    try {
        await Chatroom.delete(chatroom);
    } catch (err) {
        loading.value = false;
        error.value = err as Error;
        return;
    }

    await fetchList();
}

async function fetchList(): Promise<void> {
    loading.value = true;
    multiselect.value = false;
    error.value = undefined;

    try {
        await Chatroom.sync();
    } catch (err) {
        error.value = err as Error;
    }
    loading.value = false;
}
</script>
