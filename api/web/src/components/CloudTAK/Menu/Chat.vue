<template>
<div class='row'>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title' v-text='contact.properties.callsign'></div>
            <div/>
        </div>
    </div>
    <div class='col-12 row px-2 py-2'>
        <TablerLoading v-if='loading'/>
        <div v-else class='position-absolute'>
            <div class='position-relative bottom-0'>
                <TablerInput v-model='chat'/>
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
import { useCOTStore } from '/src/stores/cots.js';
const cotStore = useCOTStore();

export default {
    name: 'Chat',
    props: {
        uid: {
            type: String,
            required: true
        }
    },
    data: function() {
        return {
            loading: false,
            chat: '',
            contact: cotStore.cots.get(this.uid)
        }
    },
    mounted: async function() {
        await this.fetchChats();
    },
    methods: {
        fetchChats: async function() {
            this.loading = true;
            //TODO LOAD CHATS
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
