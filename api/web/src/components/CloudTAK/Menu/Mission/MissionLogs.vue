<template>
    <MenuTemplate
        name='Mission Logs'
        :back='false'
        :border='false'
        :loading='loading.logs'
        :none='!mission.logs.length && createLog === false'
    >
        <template #buttons>
            <IconPlus
                v-if='role.permissions.includes("MISSION_WRITE")'
                v-tooltip='"Create Log"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='createLog = ""'
            />
        </template>

        <template v-if='createLog !== false'>
            <div class='mx-2'>
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
                        v-if='role.permissions.includes("MISSION_WRITE")'
                        :size='32'
                        :stroke='1'
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
import { std } from '/src/std.ts';
import {
    IconPlus,
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';

export default {
    name: 'MissionLogs',
    components: {
        MenuTemplate,
        TablerInput,
        IconPlus,
        IconTrash,
    },
    props: {
        mission: Object,
        role: Object
    },
    emits: ['refresh'],
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
            this.$emit('refresh');
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
            this.$emit('refresh');
        }
    }
}
</script>
