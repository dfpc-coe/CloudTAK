<template>
<TablerModal size='xl'>
    <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
    <div class="modal-status bg-yellow"></div>
    <template v-if='mission'>
        <MissionEdit
            :missionid='mission.name'
        />
    </template>
    <template v-else>
        <ListMissions
            @mission='mission = $event'
        />
    </template>
</TablerModal>
</template>

<script>
import ListMissions from './ListMissions.vue';
import MissionEdit from './MissionEdit.vue';

import {
    TablerModal
} from '@tak-ps/vue-tabler'

export default {
    name: 'MissionModal',
    data: function() {
        return {
            mission: null
        }
    },
    methods: {
        close: function() {
            this.$emit('close');
        }
    },
    components: {
        TablerModal,
        MissionEdit,
        ListMissions
    },
}
</script>
