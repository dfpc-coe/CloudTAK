<template>
    <MenuTemplate
        :name='name'
        :loading='loading'
    >
        <template #buttons>
            <TablerIconButton
                title='Refresh'
                @click='fetchChats'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <div
                v-for='chat in chats.items'
                class='col-12 d-flex my-2 px-2'
            >
                <div
                    v-if='chat.sender_uid !== id'
                    class='bg-blue px-2 py-2 rounded'
                >
                    <span v-text='chat.message' />
                </div>
                <div
                    v-else
                    class='ms-auto bg-gray-400 px-2 py-2 rounded'
                >
                    <span v-text='chat.message' />
                </div>
            </div>

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

<script>
import { std } from '/src/std.ts';
import {
    TablerIconButton,
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
} from '@tabler/icons-vue'
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapWorkerStore } from '../../stores/worker.ts';
const mapWorkerStore = useMapWorkerStore();
import { useProfileStore } from '/src/stores/profile.ts';
const profileStore = useProfileStore();

export default {
    name: 'CloudTAKChat',
    components: {
        TablerInput,
        TablerIconButton,
        IconRefresh,
        MenuTemplate
    },
    data: function() {
        return {
            id: `ANDROID-CloudTAK-${profileStore.profile.username}`,
            loading: false,
            name: this.$route.params.chatroom === 'new' ? this.$route.query.callsign : this.$route.params.chatroom,
            chats: {
                total: 0,
                items: []
            },
            message: '',
        }
    },
    mounted: async function() {
        await this.fetchChats();
    },
    methods: {
        sendMessage: async function() {
            if (!this.message.trim().length) return;
            const chat = {
                sender_uid: this.id,
                message: this.message
            };
            this.chats.items.push(chat)
            this.message = ''

            let single;
            if (this.$route.query.uid && this.$route.query.callsign) {
                single = {
                    sender_uid: this.$route.query.uid,
                    sender_callsign: this.$route.query.callsign
                }
            } else {
                single = this.chats.items.filter((chat) => {
                    return chat.sender_uid !== this.id
                })[0];
            }

            if (!single) throw new Error('Error sending Chat - Contact is not defined');

            mapWorkerStore.worker.sendCOT({
                chatroom: single.sender_callsign,
                to: {
                    uid: single.sender_uid,
                    callsign: single.sender_callsign
                },
                from: {
                    uid: this.id,
                    callsign: profileStore.profile.tak_callsign
                },
                message: chat.message
            }, 'chat');
        },
        fetchChats: async function() {
            this.loading = true;

            if (this.$route.params.chatroom === 'new') {
                await std(`/api/profile/chat/${encodeURIComponent(this.$route.query.uid)}`);
            } else {
                this.chats = await std(`/api/profile/chat/${encodeURIComponent(this.$route.params.chatroom)}`);
            }

            this.loading = false;
        }
    }
}
</script>
