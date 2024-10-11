<template>
    <MenuTemplate
        name='Mission Logs'
        :back='false'
        :border='false'
        :loading='loading.logs'
        :none='!logs.length && createLog === false'
    >
        <div class='rows px-2'>
            <div
                v-for='log in logs'
                :key='log.id'
                class='col-12'
            >
                <div class='col-12 position-relative'>
                    <IconTrash
                        v-if='role.permissions.includes("MISSION_WRITE")'
                        :size='32'
                        :stroke='1'
                        class='position-absolute cursor-pointer end-0 mx-2 my-2'
                        @click='deleteLog(log)'
                    />
                    <pre
                        class='rounded mb-1'
                        v-text='log.content || "None"'
                    />
                </div>
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
            </div>
        </div>

        <template v-if='role.permissions.includes("MISSION_WRITE")'>
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
    </MenuTemplate>
</template>

<script>
import { std } from '/src/std.ts';
import {
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
        IconTrash,
    },
    props: {
        mission: Object,
        token: String,
        role: Object
    },
    emits: [ 'refresh' ],
    data: function() {
        return {
            createLog: '',
            logs: [],
            loading: {
                logs: false,
            },
        }
    },
    mounted: async function() {
        await this.fetchLogs()
    },
    methods: {
        fetchLogs: async function(log) {
            this.loading.logs = true;
            const list = await std(`/api/marti/missions/${this.mission.name}/log`, {
                method: 'GET',
                headers: {
                    MissionAuthorization: this.token
                },
            });

            this.logs = list.items;

            this.loading.logs = false;
        },
        deleteLog: async function(log) {
            this.loading.logs = true;
            await std(`/api/marti/missions/${this.mission.name}/log/${log.id}`, {
                method: 'DELETE',
                headers: {
                    MissionAuthorization: this.token
                },
            });
            this.loading.logs = false;
            this.$emit('refresh');
        },
        submitLog: async function() {
            this.loading.logs = true;
            await std(`/api/marti/missions/${this.mission.name}/log`, {
                method: 'POST',
                headers: {
                    MissionAuthorization: this.token
                },
                body: {
                    content: this.createLog
                }
            });

            this.createLog = '';
            this.loading.logs = false;
            this.$emit('refresh');
        }
    }
}
</script>
