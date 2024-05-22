<template>
    <div>
        <div class='col-12 border-bottom border-light'>
            <div class='modal-header px-0 mx-2'>
                <IconCircleArrowLeft
                    size='32'
                    class='cursor-pointer'
                    @click='$router.back()'
                />
                <div
                    class='modal-title'
                    v-text='$route.params.chatroom'
                />
                <div class='btn-list'>
                    <IconRefresh
                        size='32'
                        class='cursor-pointer'
                        @click='fetchChats'
                    />
                </div>
            </div>
        </div>
        <div class='px-2 py-2'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <div
                    v-for='chat in chats.items'
                    class='col-12 d-flex my-2'
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
                    <div class='row mx-2'>
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
        </div>
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCircleArrowLeft
} from '@tabler/icons-vue'
import { useConnectionStore } from '/src/stores/connection.ts';
const connectionStore = useConnectionStore();
import { useProfileStore } from '/src/stores/profile.ts';
const profileStore = useProfileStore();

export default {
    name: 'CloudTAKChat',
    components: {
        TablerInput,
        TablerLoading,
        IconRefresh,
        IconCircleArrowLeft
    },
    data: function() {
        return {
            id: `ANDROID-CloudTAK-${profileStore.profile.username}`,
            loading: false,
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

            const single = this.chats.items.filter((chat) => {
                return chat.sender_uid !== this.id
            })[0];

            if (!single) throw new Error('Contact is not defined');

            connectionStore.sendCOT({
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
            this.chats = await std(`/api/profile/chat/${encodeURIComponent(this.$route.params.chatroom)}`);
            this.loading = false;
        }
    }
}
</script>
