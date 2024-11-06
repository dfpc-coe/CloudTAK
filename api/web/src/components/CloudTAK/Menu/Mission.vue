<template>
    <MenuTemplate
        :key='mission.guid'
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
            <TablerIconButton
                v-if='!loading.initial'
                title='Refresh'
                @click='refresh'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <TablerAlert
                v-if='error'
                :err='error'
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

                <router-view
                    :mission='mission'
                    :token='token'
                    :role='role'
                    @refresh='refresh'
                />
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconRefresh,
    IconBoxMultiple,
    IconArticle,
    IconTimeline,
    IconFiles,
    IconInfoSquare,
    IconUsers,
} from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerDelete,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();

export default {
    name: 'MissionSync',
    components: {
        IconRefresh,
        MenuTemplate,
        TablerAlert,
        TablerDelete,
        TablerIconButton,
        IconBoxMultiple,
        IconArticle,
        IconFiles,
        IconInfoSquare,
        IconUsers,
        IconTimeline
    },
    emits: [
        'close',
        'select'
    ],
    data: function() {
        const token = this.$route.query.token;

        return {
            error: null,
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
                type: 'NONE',
                permissions: []
            },
            mission: {
                guid: this.$route.params.guid,
                passwordProtected: this.$route.query.passwordProtected,
            },
            imports: [],
        }
    },
    watch: {
        '$route.params.mission': async function() {
            await this.refresh();
        },
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

                const overlay = mapStore.getOverlayByMode('mission', this.mission.guid);
                if (overlay) await mapStore.removeOverlay(overlay);

                this.$router.replace('/menu/missions');
            } catch (err) {
                this.error = err;
            }
            this.loading.delete = false;
        },
        fetchMission: async function() {
            try {
                const mission = cotStore.subscriptions.get(this.$route.params.mission);

                if (mission) {
                    this.mission = mission.meta;
                    this.role = mission.role;

                    if (mission.token) {
                        this.token = mission.token;
                    }
                } else {

                    this.loading.mission = true;
                    const url = stdurl(`/api/marti/missions/${this.$route.params.mission}`);

                    this.mission = await std(url, {
                        headers: {
                            MissionAuthorization: this.token
                        }
                    });
                }
            } catch (err) {
                this.error = err;
            }

            this.loading.initial = false;
            this.loading.mission = false;
        }
    }
}
</script>
