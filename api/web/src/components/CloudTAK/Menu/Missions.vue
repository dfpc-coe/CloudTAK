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
    </TablerModal>
</template>

<script>
import MissionList from './Mission/MissionList.vue';
import MissionCreate from './Mission/MissionCreate.vue';
import {
    TablerModal
} from '@tak-ps/vue-tabler';

export default {
    name: 'CloudTAKMissions',
    components: {
        TablerModal,
        MissionCreate,
        MissionList,
    },
    data: function() {
        return {
            mode: 'list'
        };
    },
    watch: {
        mission: function() {
            this.mode = 'list';
        }
    }
}
</script>
