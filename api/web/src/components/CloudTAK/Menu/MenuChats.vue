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

                            <div class='d-flex flex-column'>
                                <div class='fw-bold'>
                                    {{ item.name }}
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
import { ref, onMounted, useTemplateRef } from 'vue'
import type { Ref } from 'vue';
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
import { useObservable } from "@vueuse/rxjs";
import { from } from 'rxjs';

const select = useTemplateRef<ComponentExposed<typeof GenericSelect>>('select');
const router = useRouter();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const multiselect = ref(false)

const chats: Ref<Array<DBChatroom> | undefined> = useObservable(
    from(liveQuery(async () => {
        return await Chatroom.list(paging.value.filter);
    }))
)

const paging = ref({
    filter: ''
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
