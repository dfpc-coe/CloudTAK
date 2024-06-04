<template>
    <MenuTemplate
        :name='mission.name || "Mission"'
        :loading='loading.initial || loading.mission'
    >
        <template #buttons>
            <TablerDelete
                v-tooltip='"Delete"'
                displaytype='icon'
                @delete='deleteMission'
            />
            <IconRefresh
                v-if='!loading.initial'
                v-tooltip='"Refresh"'
                size='32'
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
                        size='32'
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
                        size='32'
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
                        size='32'
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
                        size='32'
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
                        v-tooltip='"Contents"'
                        size='32'
                    /></label>
                </div>
            </template>

            <router-view
                :mission='mission'
                :permissions='permissions'
                @refresh='refresh'
            />
        </template>
    </MenuTemplate>

    <template v-if='mission.passwordProtected && !password'>
        <div class='modal-body'>
            <div class='d-flex justify-content-center py-3'>
                <IconLock size='32' />
            </div>
            <h3 class='text-center'>
                Mission Locked
            </h3>
            <div class='col-12 d-flex pt-2'>
                <TablerInput
                    v-model='password'
                    label='Mission Password'
                    class='w-100'
                />
                <div
                    class='ms-auto'
                    style='padding-top: 28px; padding-left: 10px;'
                >
                    <button class='btn btn-primary'>
                        Unlock Mission
                    </button>
                </div>
            </div>
        </div>
    </template>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconArticle,
    IconTimeline,
    IconFiles,
    IconLock,
    IconInfoSquare,
    IconUsers,
    IconRefresh,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerDelete,
    TablerInput,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';

export default {
    name: 'MissionSync',
    components: {
        MenuTemplate,
        TablerAlert,
        TablerDelete,
        TablerInput,
        IconArticle,
        IconFiles,
        IconInfoSquare,
        IconUsers,
        IconRefresh,
        IconLock,
        IconTimeline
    },
    emits: [
        'close',
        'select'
    ],
    data: function() {
        return {
            err: null,
            subscribed: undefined,
            mode: 'info',
            password: '',
            upload: false,
            createLog: false,
            loading: {
                initial: !this.$route.query.passwordProtected,
                mission: !this.$route.query.passwordProtected,
                users: true,
                delete: false
            },
            permissions: null,
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
        if (!this.mission.passwordProtected) {
            await this.refresh();
        }
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
            await std(`/api/marti/missions/${this.mission.name}/upload/${file.hash}`, {
                method: 'DELETE'
            });

            this.fetchMission();
        },
        genConfig: function() {
            return { id: this.mission.name }
        },
        deleteMission: async function() {
            try {
                this.loading.delete = true;
                const url = stdurl(`/api/marti/missions/${this.mission.name}`);
                const list = await std(url, {
                    method: 'DELETE'
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
                this.mission = await std(url);

            } catch (err) {
                this.err = err;
            }

            try {
                const suburl = stdurl(`/api/marti/missions/${this.mission.name}/subscription`);
                this.permissions = await std(suburl);
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
