<template>
<TablerModal size='xl'>
    <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
    <div class="modal-status bg-yellow"></div>
    <template v-if='create'>
        <MissionCreate
            @mission='mission = $event'
            @close='mission = null'
        />
    </template>
    <template v-else-if='mission'>
        <MissionEdit
            :initial='mission'
            @close='mission = null'
        />
    </template>
    <template v-else>
        <MissionList
            @mission='mission = $event'
            @create='create = true'
        />
    </template>
</TablerModal>
</template>

<script>
import MissionList from './MissionList.vue';
import MissionEdit from './MissionEdit.vue';
import MissionCreate from './MissionCreate.vue';

import {
    TablerModal
} from '@tak-ps/vue-tabler'

export default {
    name: 'MissionModal',
    data: function() {
        return {
            create: false,
            mission: null
        }
    },
    watch: {
        mission: function() {
            this.create = false;
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
        MissionList,
        MissionCreate,
    },
}
</script>
