<template>
    <MissionList
        :modal='false'
        @create='mode = "create"'
        @mission='mission = $event'
        @close='$router.back()'
    />
    <TablerModal size='xl' v-if='mode !== "list"'>
        <div class="modal-status bg-red"></div>
        <button type="button" class="btn-close" @click='mode = "list"' aria-label="Close"></button>
        <MissionCreate
            v-if='mode === "create"'
            @mission='mode = "list"'
            @chat='$emit("chat", $event)'
            @close='mode = "list"'
        />
        <Mission
            v-else-if='mode === "edit"'
            :initial='mission'
            @close='mode = "list"'
        />
    </TablerModal>
</template>

<script>
import MissionList from '../Mission/MissionList.vue';
import Mission from '../Mission/Mission.vue';
import MissionCreate from '../Mission/MissionCreate.vue';
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
        mode: function() {
            if (this.mode === 'list') {
                this.mission = false;
            }
        },
        mission: function() {
            if (this.mission) {
                this.mode = 'edit';
            } else {
                this.mode = 'list';
            }
        }
    },
    components: {
        TablerModal,
        MissionCreate,
        Mission,
        MissionList,
    }
}
</script>
