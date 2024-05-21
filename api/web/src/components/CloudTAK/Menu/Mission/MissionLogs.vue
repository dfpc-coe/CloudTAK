<template>
<MenuTemplate
    name='Mission Logs'
    :back='false'
    :border='false'
    :loading='loading.logs'
    :none='!mission.logs.length'
>
    <template #buttons>
        <IconPlus
            v-tooltip='"Create Log"'
            size='32'
            class='cursor-pointer'
            @click='createLog = ""'
        />
    </template>
    <template v-if='createLog !== false'>
        <TablerInput
            v-model='createLog'
            label='Create Log'
            :rows='4'
        />

        <div class='d-flex my-2'>
            <div class='ms-auto'>
                <button
                    class='btn btn-primary'
                    @click='submitLog'
                >
                    Save Log
                </button>
            </div>
        </div>
    </template>

    <div
        v-else
        class='rows'
    >
        <div
            v-for='log in mission.logs'
            :key='log.id'
            class='col-12'
        >
            <div class='d-flex'>
                <label
                    class='subheader'
                    v-text='log.creatorUid'
                />
                <label
                    class='subheader ms-auto'
                    v-text='log.created'
                />
            </div>
            <div class='col-12 position-relative'>
                <IconTrash
                    size='32'
                    class='position-absolute cursor-pointer end-0 mx-2 my-2'
                    @click='deleteLog(log)'
                />
                <pre v-text='log.content || "None"' />
            </div>
        </div>
    </div>
</MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerNone,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'MissionLogs',
    components: {
        MenuTemplate,
        TablerNone,
        TablerAlert,
        TablerLoading,
        TablerDelete,
        TablerInput,
        IconTrash,
    },
    props: {
        mission: Object
    },
    data: function() {
        return {
            createLog: false,
            loading: {
                logs: false,
            },
        }
    },
    methods: {
        deleteLog: async function(log) {
            this.loading.logs = true;
            await std(`/api/marti/missions/${this.mission.name}/log/${log.id}`, {
                method: 'DELETE',
            });
            this.loading.logs = false;
            this.fetchMission();
        },
        submitLog: async function() {
            this.loading.logs = true;
            await std(`/api/marti/missions/${this.mission.name}/log`, {
                method: 'POST',
                body: {
                    content: this.createLog
                }
            });
            this.createLog = false;
            this.loading.logs = false;
            this.fetchMission();
        }
    }
}
</script>
