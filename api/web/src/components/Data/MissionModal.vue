<template>
<TablerModal size='xl'>
    <div class="modal-status bg-yellow"></div>
    <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
    <template v-if='create'>
        <MissionCreate
            @mission='mission = $event'
            @close='mission = null'
        />
    </template>
    <template v-else-if='mission'>
        <MissionEdit
            :initial='mission'
            :selectable='selectable'
            @select='$emit("select", $event)'
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
import MissionList from '../Mission/MissionList.vue';
import MissionEdit from '../Mission/MissionEdit.vue';
import MissionCreate from '../Mission/MissionCreate.vue';

import {
    TablerModal
} from '@tak-ps/vue-tabler'

export default {
    name: 'MissionModal',
    props: {
        selectable: {
            type: Boolean,
            default: false
        },
        initial: {
            type: Object,
            default: null
        }
    },
    data: function() {
        return {
            create: false,
            mission: this.initial || null
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
