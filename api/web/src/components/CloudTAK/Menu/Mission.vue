<template>
    <MenuTemplate
        :name='mission.name || "Mission"'
        :loading='loading.initial || loading.mission'
    >
        <template #buttons>
            <TablerDelete
                v-if='role.permissions.includes("MISSION_WRITE")'
                v-tooltip='"Delete"'
                displaytype='icon'
                @delete='deleteMission'
            />
            <IconRefresh
                v-if='!loading.initial'
                v-tooltip='"Refresh"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='refresh'
            />
        </template>
        <template #default>
            <TablerAlert
                v-if='err'
                :err='err'
            />
            <template v-else>
                <div
                    class='px-2 py-2 round btn-group w-100'
                    role='group'
                >
                    <input
                        id='info'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='$route.name === "home-menu-mission-info"'
                        @click='$router.replace(`/menu/missions/${$route.params.mission}/info`)'
                    >
                    <label
                        for='info'
                        type='button'
                        class='btn btn-sm'
                    ><IconInfoSquare
                        v-tooltip='"Metadata"'
                        :size='32'
                        :stroke='1'
                    /></label>

                    <input
                        id='layer'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='$route.name === "home-menu-mission-layers"'
                        @click='$router.replace(`/menu/missions/${$route.params.mission}/layers`)'
                    >
                    <label
                        for='layer'
                        type='button'
                        class='btn btn-sm'
                    ><IconBoxMultiple
                        v-tooltip='"Layers"'
                        :size='32'
                        :stroke='1'
                    /></label>

                    <input
                        id='users'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='$route.name === "home-menu-mission-users"'
                        @click='$router.replace(`/menu/missions/${$route.params.mission}/users`)'
                    >
                    <label
                        for='users'
                        type='button'
                        class='btn btn-sm'
                    ><IconUsers
                        v-tooltip='"Users"'
                        :size='32'
                        :stroke='1'
                    /></label>

                    <input
                        id='timeline'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='$route.name === "home-menu-mission-timeline"'
                        @click='$router.replace(`/menu/missions/${$route.params.mission}/timeline`)'
                    >
                    <label
                        for='timeline'
                        type='button'
                        class='btn btn-sm'
                    ><IconTimeline
                        v-tooltip='"Timeline"'
                        :size='32'
                        :stroke='1'
                    /></label>

                    <input
                        id='logs'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='$route.name === "home-menu-mission-logs"'
                        @click='$router.replace(`/menu/missions/${$route.params.mission}/logs`)'
                    >
                    <label
                        for='logs'
                        type='button'
                        class='btn btn-sm'
                    ><IconArticle
                        v-tooltip='"Logs"'
                        :size='32'
                        :stroke='1'
                    /></label>

                    <input
                        id='contents'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='$route.name === "home-menu-mission-contents"'
                        @click='$router.replace(`/menu/missions/${$route.params.mission}/contents`)'
                    >
                    <label
                        for='contents'
                        type='button'
                        class='btn btn-sm'
                    ><IconFiles
                        v-tooltip='"Files"'
                        :size='32'
                        :stroke='1'
                    /></label>
                </div>
            </template>

            <router-view
                :mission='mission'
                :token='token'
                :role='role'
                @refresh='refresh'
            />
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconBoxMultiple,
    IconArticle,
    IconTimeline,
    IconFiles,
    IconInfoSquare,
    IconUsers,
    IconRefresh,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerDelete,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';

export default {
    name: 'MissionSync',
    components: {
        MenuTemplate,
        TablerAlert,
        TablerDelete,
        IconBoxMultiple,
        IconArticle,
        IconFiles,
        IconInfoSquare,
        IconUsers,
        IconRefresh,
        IconTimeline
    },
    emits: [
        'close',
        'select'
    ],
    data: function() {
        const token = this.$route.query.token;

        return {
            err: null,
            subscribed: undefined,
            token,
            upload: false,
            createLog: false,
            loading: {
                initial: !this.$route.query.passwordProtected,
                mission: !this.$route.query.passwordProtected,
                users: true,
                delete: false
            },
            role: {
                type: 'MISSION_SUBSCRIBER',
                permissions: ['MISSION_READ']
            },
            mission: {
                guid: this.$route.params.guid,
                passwordProtected: this.$route.query.passwordProtected,
            },
            imports: [],
        }
    },
    watch: {
        upload: async function() {
            if (!this.upload) await this.refresh();
        }
    },
    mounted: async function() {
        await this.refresh();
    },
    methods: {
        refresh: async function() {
            await this.fetchMission();
        },
        downloadFile: function(file) {
            const url = stdurl(`/api/marti/api/files/${file.hash}`)
            url.searchParams.append('token', localStorage.token);
            url.searchParams.append('name', file.name);
            return url;
        },
        deleteFile: async function(file) {
            await std(`/api/marti/missions/${this.mission.guid}/upload/${file.hash}`, {
                method: 'DELETE',
                headers: {
                    MissionAuthorization: this.token
                }
            });

            this.fetchMission();
        },
        genConfig: function() {
            return { id: this.mission.name }
        },
        deleteMission: async function() {
            try {
                this.loading.delete = true;
                const url = stdurl(`/api/marti/missions/${this.mission.guid}`);
                const list = await std(url, {
                    method: 'DELETE',
                    headers: {
                        MissionAuthorization: this.token
                    }
                });
                if (list.data.length !== 1) throw new Error('Mission Error');

                this.$router.replace('/menu/missions');
            } catch (err) {
                this.err = err;
            }
            this.loading.delete = false;
        },
        fetchMission: async function() {
            try {
                this.loading.mission = true;
                const url = stdurl(`/api/marti/missions/${this.$route.params.mission}`);
                url.searchParams.append('changes', 'false');
                url.searchParams.append('logs', 'true');
                this.mission = await std(url, {
                    headers: {
                        MissionAuthorization: this.token
                    }
                });

            } catch (err) {
                this.err = err;
            }

            try {
                const suburl = stdurl(`/api/marti/missions/${this.mission.guid}/role`);
                this.role = await std(suburl, {
                    headers: {
                        MissionAuthorization: this.token
                    }
                });
            } catch (err) {
                if (!err.message.includes('NOT_FOUND')) {
                    throw err;
                }
            }
            this.loading.initial = false;
            this.loading.mission = false;
        }
    }
}
</script>
