<template>
<MenuTemplate
    name='Mission Contents'
    :back='false'
    :border='false'
>
    <TablerAlert v-if='err' :err='err'/>
    <UploadImport
        v-if='upload'
        mode='Mission'
        :modeid='mission.guid'
        :config='genConfig()'
        @cancel='upload = false'
        @done='upload = false'
    />
    <TablerNone
        v-else-if='!mission.contents.length'
        :create='false'
    />
    <template v-else>
        <div
            v-for='content in mission.contents'
            :key='content.data.uid'
            class='col-12 d-flex px-2 py-2 hover-dark'
        >
            <div>
                <span v-text='content.data.name' class='txt-truncate'/>
                <div class='col-12'>
                    <span
                        class='subheader'
                        v-text='content.data.submitter'
                    /> - <span
                        class='subheader'
                        v-text='content.data.submissionTime'
                    />
                </div>
            </div>
            <div class='col-auto ms-auto btn-list'>
                <TablerDelete
                    displaytype='icon'
                    @delete='deleteFile(content.data)'
                />
                <a
                    v-tooltip='"Download Asset"'
                    :href='downloadFile(content.data)'
                ><IconDownload
                    size='32'
                    class='cursor-pointer'
                /></a>
            </div>
        </div>
    </template>

    <template v-if='imports.length'>
        <label class='subheader'>Imports</label>

        <div
            v-for='imp in imports'
            :key='imp.id'
            class='col-12 d-flex align-items-center hover-dark cursor-pointer rounded'
            @click='$router.push(`/import/${imp.id}`)'
        >
            <Status :status='imp.status' /><span
                class='mx-2'
                v-text='imp.name'
            />
        </div>
    </template>
</MenuTemplate>
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
import UploadImport from '../../util/UploadImport.vue';
import Status from '../../../util/Status.vue';
import {
    TablerAlert,
    TablerNone,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import MenuTemplate from '../../util/MenuTemplate.vue';

export default {
    name: 'MissionContents',
    props: {
        mission: Object
    },
    components: {
        Status,
        MenuTemplate,
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
                logs: false,
                changes: true,
                users: true,
                delete: false
            },
            imports: [],
        }
    },
    watch: {
        upload: async function() {
            if (!this.upload) await this.refresh();
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
        }
    }
}
</script>
