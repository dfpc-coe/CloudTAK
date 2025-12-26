<template>
    <MenuTemplate
        :name='name'
        :loading='loading'
    >
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
            <TablerRefreshButton
                :loading='loading'
                @click='fetchChats'
            />
        </template>
        <template #default>
            <TablerLoading v-if='loading' />
            <GenericSelect
                v-else
                ref='select'
                role='menu'
                :disabled='!multiselect'
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
                    <div class='w-100 d-flex my-2 px-2'>
                        <div
                            v-if='item.sender_uid !== id'
                            class='bg-blue px-2 py-2 rounded'
                        >
                            <span v-text='item.message' />
                        </div>
                        <div
                            v-else
                            class='ms-auto bg-accent px-2 py-2 rounded'
                        >
                            <span v-text='item.message' />
                        </div>
                    </div>
                </template>
            </GenericSelect>

            <div class='border-top position-absolute start-0 bottom-0 end-0'>
                <div class='d-flex align-items-center mx-2 my-2'>
                    <div class='flex-grow-1 me-2'>
                        <TablerInput
                            v-model='message'
                            @keyup.enter='sendMessage'
                        />
                    </div>
                    <div>
                        <TablerIconButton
                            title='Send Message'
                            @click='sendMessage'
                        >
                            <IconSend
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup>
import { ref, onMounted, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import Chatroom from '../../../base/chatroom.ts';
import GenericSelect from '../util/GenericSelect.vue';
import { useObservable } from '@vueuse/rxjs';
import { liveQuery } from 'dexie';
import { from } from 'rxjs';
import {
    IconListCheck,
    IconSend,
} from '@tabler/icons-vue';
import {
    TablerRefreshButton,
    TablerDelete,
    TablerIconButton,
    TablerInput,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();

const route = useRoute();

const id = ref('')
const callsign = ref('');
const loading = ref(true);
const select = ref(null);
const multiselect = ref(false);
const name = ref(route.params.chatroom === 'new' ? route.query.callsign : route.params.chatroom);
const room = shallowRef();

const chats = useObservable(
    from(liveQuery(async () => {
        if (!room.value) return [];
        if (route.params.chatroom === 'new') return [];
        return await room.value.chats.list();
    })),
    { initialValue: [] }
);

const message = ref('');

onMounted(async () => {
    const profile = await mapStore.worker.profile.load();
    id.value = `ANDROID-CloudTAK-${profile.username}`
    callsign.value = profile.tak_callsign;

    room.value = new Chatroom(name.value);

    await fetchChats();
});

async function sendMessage() {
    if (!message.value.trim().length) return;
    if (!room.value) return;

    let recipient;
    if (route.query.uid && route.query.callsign) {
        recipient = {
            uid: String(route.query.uid),
            callsign: String(route.query.callsign)
        }
    }

    await room.value.chats.send(
        message.value,
        { uid: id.value, callsign: callsign.value },
        mapStore.worker,
        recipient
    );

    message.value = ''
}

async function deleteChats() {
    if (!select.value) return;
    if (!room.value) return;
    const selected = select.value.selected;

    loading.value = true;

    try {
        await room.value.deleteChats(Array.from(selected.values()));
    } catch (err) {
        loading.value = false;
        throw new Error(err.message);
    }

    await fetchChats();
}

async function fetchChats() {
    loading.value = true;

    if (route.params.chatroom !== 'new' && room.value) {
        try {
            await Chatroom.load(room.value.name, { reload: false });
            await room.value.chats.refresh();
        } catch (err) {
            console.error(err);
        }
    }

    loading.value = false;
}
</script>
