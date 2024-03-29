<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title' v-text='$route.params.chatroom'></div>
            <div class='btn-list'>
                <IconRefresh @click='fetchChats' size='32' class='cursor-pointer'/>
            </div>
        </div>
    </div>
    <div class='px-2 py-2'>
        <TablerLoading v-if='loading'/>

        <div class='border-top border-blue position-absolute start-0 bottom-0 end-0'>
            <div class='row mx-2'>
                <div class='col-12'>
                    <TablerInput v-on:keyup.enter='sendMessage' v-model='message'/>
                </div>
                <div class='col-12 my-2'>
                    <button @click='sendMessage' class='w-100 btn btn-primary'>Send</button>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<script>
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft
} from '@tabler/icons-vue'
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();

export default {
    name: 'CloudTAKChat',
    data: function() {
        return {
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
        },
        fetchChats: async function() {
            this.loading = true;
            this.chats = await window.std(`/api/chat/${encodeURIComponent(this.$route.params.chatroom)}`
            this.loading = false;
        }
    },
    components: {
        TablerInput,
        TablerLoading,
        IconCircleArrowLeft
    }
}
</script>
