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
            <GenericSelect
                ref='select'
                role='menu'
                :disabled='!multiselect'
                :items='chats.items'
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

            <div class='border-top border-blue position-absolute start-0 bottom-0 end-0'>
                <div class='row mx-2 mt-2'>
                    <div class='col-12'>
                        <TablerInput
                            v-model='message'
                            @keyup.enter='sendMessage'
                        />
                    </div>
                    <div class='col-12 my-2'>
                        <button
                            class='w-100 btn btn-primary'
                            @click='sendMessage'
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { server } from '../../../std.ts';
import GenericSelect from '../util/GenericSelect.vue';
import {
    IconListCheck,
} from '@tabler/icons-vue';
import {
    TablerRefreshButton,
    TablerDelete,
    TablerIconButton,
    TablerInput,
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
const chats = ref({
    total: 0,
    items: []
});

const message = ref('');

onMounted(async () => {
    const profile = await mapStore.worker.profile.load();
    id.value = `ANDROID-CloudTAK-${profile.username}`
    callsign.value = profile.tak_callsign;

    await fetchChats();
});

async function sendMessage() {
    if (!message.value.trim().length) return;
    const chat = {
        sender_uid: id.value,
        message: message.value
    };
    chats.value.items.push(chat)
    message.value = ''

    let single;
    if (route.query.uid && route.query.callsign) {
        single = {
            sender_uid: route.query.uid,
            sender_callsign: route.query.callsign
        }
    } else {
        single = chats.value.items.filter((chat) => {
            return chat.sender_uid !== id.value
        })[0];
    }

    if (!single) throw new Error('Error sending Chat - Contact is not defined');

    await mapStore.worker.conn.sendCOT({
        chatroom: single.sender_callsign,
        to: {
            uid: single.sender_uid,
            callsign: single.sender_callsign
        },
        from: {
            uid: id.value,
            callsign: callsign.value
        },
        message: chat.message
    }, 'chat');
}

async function deleteChats() {
    if (!select.value) return;
    const selected = select.value.selected;

    loading.value = true;

    const res = await server.DELETE('/api/profile/chatroom/{:chatroom}/chat', {
        params: {
            query: {
                chat: Array.from(selected.values())
            }
        }
    });

    if (res.error) {
        loading.value = false;
        throw new Error(res.error.message);
    }

    await fetchChats();
}

async function fetchChats() {
    loading.value = true;

    if (route.params.chatroom !== 'new') {
        const res = await server.GET(`/api/profile/chatroom/{:chatroom}/chat`, {
            params: {
                path: {
                    ':chatroom': route.params.chatroom
                }
            }
        });

        chats.value = res.data;
    }

    loading.value = false;
}
</script>
