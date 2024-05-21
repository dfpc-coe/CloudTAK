<template>
    <MenuTemplate
        :name='mission.name || "Mission"'
        :loading='loading.initial || loading.mission'
    >
        <template #buttons>
            <template v-if='mode === "info"'>
                <TablerDelete
                    v-tooltip='"Delete"'
                    displaytype='icon'
                    @delete='deleteMission'
                />
            </template>
            <template v-else-if='mode === "contents"'>
                <IconPlus
                    v-if='!upload'
                    v-tooltip='"Upload File"'
                    size='32'
                    class='cursor-pointer'
                    @click='upload = true'
                />
            </template>
            <template v-else-if='mode === "logs"'>
                <IconPlus
                    v-tooltip='"Create Log"'
                    size='32'
                    class='cursor-pointer'
                    @click='createLog = ""'
                />
            </template>

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
                <div class='mx-2 my-2'>
                    <div class='d-flex align-items-center'>
                        <button
                            v-if='subscribed === false'
                            class='btn btn-green'
                            style='height: 32px;'
                            @click='subscribe(true)'
                        >
                            Subscribe
                        </button>
                        <button
                            v-else-if='subscribed === true'
                            class='btn btn-danger'
                            style='height: 32px;'
                            @click='subscribe(false)'
                        >
                            Unsubscribe
                        </button>
                    </div>
                </div>
                <div
                    class='btn-group w-100'
                    role='group'
                >
                    <input
                        id='info'
                        type='radio'
                        class='btn-check'
                        autocomplete='off'
                        :checked='$router.name === "menu-mission-info"'
                        @click='$router.push(`/menu/missions/${$route.params.mission}/info`)'
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
                        :checked='$router.name === "menu-mission-users"'
                        @click='$router.push(`/menu/missions/${$route.params.mission}/users`)'
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
                        :checked='$router.name === "menu-mission-timeline"'
                        @click='$router.push(`/menu/missions/${$route.params.mission}/timeline`)'
                    >
                    <label
                        for='users'
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
                        :checked='$router.name === "menu-mission-logs"'
                        @click='$router.push(`/menu/missions/${$route.params.mission}/logs`)'
                    >
                    <label
                        for='users'
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
                        :checked='$router.name === "menu-mission-contents"'
                        @click='$router.push(`/menu/missions/${$route.params.mission}/contents`)'
                    >
                    <label
                        for='users'
                        type='button'
                        class='btn btn-sm'
                    ><IconFiles
                        v-tooltip='"Contents"'
                        size='32'
                    /></label>
                </div>
            </template>

            <div class='mx-2 my-2'>
                <router-view
                    :mission='mission'
                    :subscriptions='subscriptions'
                />
            </div>
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
    IconPlus,
    IconVolcano,
    IconFileX,
    IconArticle,
    IconTimeline,
    IconDownload,
    IconFiles,
    IconFile,
    IconPolygon,
    IconLock,
    IconInfoSquare,
    IconUsers,
    IconRefresh,
    IconTrash,
} from '@tabler/icons-vue';
import UploadImport from '../util/UploadImport.vue';
import Status from '../../util/Status.vue';
import {
    TablerAlert,
    TablerNone,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'MissionSync',
    components: {
        MenuTemplate,
        Status,
        TablerNone,
        UploadImport,
        TablerAlert,
        TablerLoading,
        TablerDelete,
        TablerInput,
        IconVolcano,
        IconPlus,
        IconArticle,
        IconDownload,
        IconFiles,
        IconFile,
        IconPolygon,
        IconInfoSquare,
        IconUsers,
        IconTrash,
        IconRefresh,
        IconLock,
        IconFileX,
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
            changes: [],
            loading: {
                initial: !this.$route.query.passwordProtected,
                mission: !this.$route.query.passwordProtected,
                logs: false,
                changes: true,
                users: true,
                delete: false
            },
            mission: {
                guid: this.$route.params.guid,
                passwordProtected: this.$route.query.passwordProtected,
            },
            imports: [],
            subscriptions: []
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
        subscribe: async function(subscribed) {
            const layer = mapStore.getLayerByMode('mission', this.mission.guid);

            if (subscribed === true && !layer) {
                await mapStore.addDefaultLayer({
                    id: this.mission.guid,
                    url: `/mission/${encodeURIComponent(this.mission.name)}`,
                    name: this.mission.name,
                    source: this.mission.guid,
                    type: 'geojson',
                    before: 'CoT Icons',
                    mode: 'mission',
                    mode_id: this.mission.guid,
                    clickable: [
                        { id: `${this.mission.guid}-poly`, type: 'feat' },
                        { id: `${this.mission.guid}-polyline`, type: 'feat' },
                        { id: `${this.mission.guid}-line`, type: 'feat' },
                        { id: this.mission.guid, type: 'feat' }
                    ]
                });
            } else if (subscribed === false && layer) {
                await mapStore.removeLayer(this.mission.name);
            }

            this.subscribed = !!mapStore.getLayerByMode('mission', this.mission.guid);
        },
        refresh: async function() {
            await this.fetchMission();
            this.subscribed = !!mapStore.getLayerByMode('mission', this.mission.guid);

            await Promise.all([
                this.fetchSubscriptions(),
                this.fetchChanges(),
                this.fetchImports()
            ]);
        },
        downloadFile: function(file) {
            const url = stdurl(`/api/marti/api/files/${file.hash}`)
            url.searchParams.append('token', localStorage.token);
            url.searchParams.append('name', file.name);
            return url;
        },
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
        fetchImports: async function() {
            try {
                const url = await stdurl(`/api/import`);
                url.searchParams.append('mode', 'Mission');
                url.searchParams.append('mode_id', this.mission.guid);
                this.imports = (await std(url)).items.filter((i) => {
                    return !['Success'].includes(i.status);
                });
            } catch (err) {
                this.err = err;
            }
            this.loading.users = false;
        },
        fetchChanges: async function() {
            this.loading.changes = true;
            try {
                const url = await stdurl(`/api/marti/missions/${this.mission.name}/changes`);
                this.changes = (await std(url)).data;
            } catch (err) {
                this.err = err;
            }
            this.loading.changes = false;
        },
        fetchSubscriptions: async function() {
            try {
                const url = await stdurl(`/api/marti/missions/${this.mission.name}/subscriptions/roles`);
                this.subscriptions = (await std(url)).data;
            } catch (err) {
                this.err = err;
            }
            this.loading.users = false;
        },
        deleteMission: async function() {
            try {
                this.loading.delete = true;
                const url = stdurl(`/api/marti/missions/${this.mission.name}`);
                const list = await std(url, {
                    method: 'DELETE'
                });
                if (list.data.length !== 1) throw new Error('Mission Error');
                this.$emit('close');
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
            this.loading.initial = false;
            this.loading.mission = false;
        }
    }
}
</script>
