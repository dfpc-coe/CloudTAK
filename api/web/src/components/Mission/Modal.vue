<template>
<TablerModal size='xl'>
    <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
    <div class="modal-status bg-yellow"></div>
    <div class="modal-body text-center py-4">
        <ListMissions/>
    </div>
</TablerModal>
</template>

<script>
import ListMissions from './ListMissions.vue';

import {
    TablerModal
} from '@tak-ps/vue-tabler'

export default {
    name: 'MissionModal',
    components: {
        TablerModal,
        ListMissions
    },
    methods: {
        close: function() {
            this.$emit('close');
        }
    }
}
</script>
