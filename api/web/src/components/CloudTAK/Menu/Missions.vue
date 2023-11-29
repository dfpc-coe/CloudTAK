<template>
    <MissionList
        :modal='false'
        @create='mode = "create"'
        @mission='mission = $event'
    />
    <TablerModal size='xl' v-if='mode !== "list"' class='text-black'>
    <div class="modal-status bg-yellow"></div>
        <button type="button" class="btn-close" @click='mode = "list"' aria-label="Close"></button>
        <MissionCreate
            v-if='mode === "create"'
        />
        <MissionEdit
            v-else-if='mode === "edit"'
            :initial='mission'
        />
    </TablerModal>
</template>

<script>
import MissionList from '../../Mission/MissionList.vue';
import MissionEdit from '../../Mission/MissionEdit.vue';
import MissionCreate from '../../Mission/MissionCreate.vue';
import MissionModal from '../../Mission/Modal.vue';
import {
    TablerModal
} from '@tak-ps/vue-tabler';

export default {
    name: 'Missions',
    data: function() {
        return {
            mode: 'list',
            mission: false
        };
    },
    watch: {
        mission: function() {
            if (this.mission) this.mode = 'edit';
            else this.mode = 'list';
        }
    },
    components: {
        TablerModal,
        MissionCreate,
        MissionEdit,
        MissionList,
    }
}
</script>
