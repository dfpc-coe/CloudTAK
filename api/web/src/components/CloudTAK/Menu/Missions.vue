<template>
    <MissionList
        :modal='false'
        @create='mode = "create"'
        @mission='mission = $event'
        @close='$router.back()'
    />
    <TablerModal
        v-if='mode !== "list"'
        size='xl'
    >
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='mode = "list"'
        />
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
    name: 'CloudTAKMissions',
    components: {
        TablerModal,
        MissionCreate,
        Mission,
        MissionList,
    },
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
    }
}
</script>
