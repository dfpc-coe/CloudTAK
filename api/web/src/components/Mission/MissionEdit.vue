<template>
<div class='col-12'>
    <TablerLoading v-if='loading.initial' desc='Loading Mission'/>
    <template v-else>
        <div class='d-flex px-1 py-1'>
            <div class='row'>
                <div class='col-auto d-flex justify-content-center align-items-center mx-2'>
                    <IconLock v-if='mission.passwordProtected'/>
                    <IconLockOpen v-else/>
                </div>
                <div class='col-auto row'>
                    <div class='col-12'>
                        <span v-text='mission.name'/>
                    </div>
                    <div class='col-12'>
                        <span v-if='mission.createTime' v-text='mission.createTime.replace(/T.*/, "")' class='text-secondary'/>
                        <span v-if='mission.createTime'>&nbsp;-&nbsp;</span>
                        <span v-if='Array.isArray(mission.contents)' v-text='mission.contents.length + " Items"' class='text-secondary'/>
                    </div>
                </div>
            </div>
            <div class='ms-auto btn-list my-2' style='padding-right: 56px;'>
                <template v-if='mode === "info"'>
                    <TablerDelete @delete='deleteMission' displaytype='icon' v-tooltip='"Delete"'/>
                    <IconPencil class='cursor-pointer' v-tooltip='"Edit"'/>
                </template>
                <template v-else-if='mode === "contents"'>
                    <IconPlus v-if='!upload' @click='upload = true' v-tooltip='"Upload File"' class='cursor-pointer'/>
                </template>
                <template v-else-if='mode === "logs"'>
                    <IconPlus @click='createLog = ""' v-tooltip='"Create Log"' class='cursor-pointer'/>
                </template>

                <IconRefresh v-if='!loading.initial' @click='refresh' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
        <TablerLoading v-if='loading.mission' desc='Loading Mission'/>
        <TablerLoading v-else-if='loading.delete' desc='Deleting Mission'/>
        <Alert v-else-if='err' :err='err'/>
        <template v-else-if='this.initial.passwordProtected && !password'>
            <div class='modal-body'>
                <div class='d-flex justify-content-center py-3'>
                    <IconLock width='32' height='32' />
                </div>
                <h3 class='text-center'>Mission Locked</h3>
                <div class='col-12 d-flex pt-2'>
                    <TablerInput v-model='password' label='Mission Password' class='w-100'/>
                    <div class='ms-auto' style='padding-top: 28px; padding-left: 10px;'>
                        <button class='btn btn-primary'>Unlock Mission</button>
                    </div>
                </div>
            </div>
        </template>
        <template v-else>
            <div class='d-flex'>
                <div class="border-end" style='width: 40px;'>
                    <div @click='mode = "info"' class='px-2 py-2' :class='{
                        "bg-blue-lt": mode === "info",
                        "cursor-pointer": mode !== "info"
                    }'><IconInfoSquare v-tooltip='"Metadata"'/></div>
                    <div @click='mode = "users"' class='px-2 py-2' :class='{
                        "bg-blue-lt": mode === "users",
                        "cursor-pointer": mode !== "users"
                    }'><IconUsers v-tooltip='"Users"'/></div>
                    <div @click='mode = "logs"' class='px-2 py-2' :class='{
                        "bg-blue-lt": mode === "logs",
                        "cursor-pointer": mode !== "logs"
                    }'><IconArticle v-tooltip='"Logs"'/></div>
                    <div @click='mode = "contents"' class='px-2 py-2' :class='{
                        "bg-blue-lt": mode === "contents",
                        "cursor-pointer": mode !== "contents"
                    }'><IconFiles v-tooltip='"Contents"'/></div>
                </div>
                <div class="mx-2 my-2" style='width: calc(100% - 40px);'>
                    <template v-if='mode === "info"'>
                        <div class="datagrid-item pb-2">
                            <div class="datagrid-title">Created</div>
                            <div class="datagrid-content" v-text='mission.createTime'></div>
                        </div>
                        <div class="datagrid-item pb-2">
                            <div class="datagrid-title">Updated</div>
                            <div class="datagrid-content"></div>
                        </div>
                        <div class="datagrid-item pb-2">
                            <div class="datagrid-title">Groups (Channels)</div>
                            <div class="datagrid-content" v-text='mission.groups.join(", ")'></div>
                        </div>
                        <div class="datagrid-item pb-2">
                            <div class="datagrid-title">Description</div>
                            <div class="datagrid-content" v-text='mission.description || "No Feed Description"'></div>
                        </div>
                    </template>
                    <template v-else-if='mode === "users"'>
                    </template>
                    <template v-else-if='mode === "contents"'>
                        <template v-if='upload'>
                            <UploadImport
                                mode='Mission'
                                :modeid='mission.guid'
                                :config='genConfig()'
                                @cancel='upload = false'
                                @done='upload = false'
                            />
                        </template>
                        <TablerNone v-else-if='!mission.contents.length' :create='false'/>
                        <template v-else>
                            <div :key='content.data.uid' v-for='content in mission.contents' class='col-12 d-flex'>
                                <div>
                                    <span v-text='content.data.name'/>
                                    <div class='col-12'>
                                        <span class='subheader' v-text='content.data.submitter'/> - <span class='subheader' v-text='content.data.submissionTime'/>
                                    </div>
                                </div>
                                <div class='ms-auto btn-list'>
                                    <TablerDelete @delete='deleteFile(content.data)' displaytype='icon'/>
                                    <a :href='downloadFile(content.data)' v-tooltip='"Download Asset"'><IconDownload class='cursor-pointer'/></a>
                                </div>
                            </div>
                        </template>

                        <template v-if='imports.length'>
                            <label class='subheader'>Imports</label>

                            <div @click='$router.push(`/import/${imp.id}`)' :key='imp.id' v-for='imp in imports' class='col-12 d-flex align-items-center hover-light cursor-pointer rounded'>
                                <Status :status='imp.status'/><span class='mx-2' v-text='imp.name'/>
                            </div>
                        </template>
                    </template>
                    <template v-else-if='mode === "logs"'>
                        <TablerLoading v-if='loading.logs'/>
                        <template v-else-if='createLog !== false'>
                            <TablerInput label='Create Log' :rows='4' v-model='createLog'/>

                            <div class='d-flex my-2'>
                                <div class='ms-auto'>
                                    <button @click='submitLog' class='btn btn-primary'>Save Log</button>
                                </div>
                            </div>
                        </template>
                        <TablerNone v-else-if='!mission.logs.length' :create='false'/>
                        <div v-else class='rows'>
                            <div :key='log.id' v-for='log in mission.logs' class='col-12'>
                                <div class='d-flex'>
                                    <label class='subheader' v-text='log.creatorUid'/>
                                    <label class='subheader ms-auto' v-text='log.created'/>
                                </div>
                                <pre v-text='log.content || "None"'/>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
            <div v-if='selectable' class='modal-footer'>
                <button @click='$emit("select", mission)' class='btn btn-primary'>Select</button>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import {
    IconPlus,
    IconArticle,
    IconDownload,
    IconFiles,
    IconLock,
    IconInfoSquare,
    IconUser,
    IconUsers,
    IconLockOpen,
    IconPencil,
    IconRefresh,
} from '@tabler/icons-vue';
import Alert from '../util/Alert.vue';
import UploadImport from '../util/UploadImport.vue';
import Status from '../util/Status.vue';
import {
    TablerNone,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'MissionEdit',
    props: {
        connection: {
            type: Number
        },
        initial: {
            type: Object
        },
        selectable: {
            type: Boolean,
            default: false
        }
    },
    data: function() {
        return {
            err: null,
            mode: 'info',
            password: '',
            upload: false,
            createLog: false,
            loading: {
                initial: !this.initial.passwordProtected,
                mission: !this.initial.passwordProtected,
                logs: false,
                users: true,
                delete: false
            },
            mission: {
                name: this.initial.name || 'Unknown',
                passwordProtected: this.initial.passwordProtected,
            },
            imports: [],
            contacts: []
        }
    },
    mounted: async function() {
        if (!this.mission.passwordProtected) {
            await this.refresh();
        }
    },
    watch: {
        upload: async function() {
            if (!this.upload) await this.refresh();
        }
    },
    methods: {
        refresh: async function() {
            await this.fetchMission();

            await Promise.all([
                this.fetchContacts(),
                this.fetchImports()
            ]);
        },
        downloadFile: function(file) {
            const url = window.stdurl(`/api/marti/api/files/${file.hash}`)
            url.searchParams.append('token', localStorage.token);
            url.searchParams.append('name', file.name);
            return url;
        },
        submitLog: async function(file) {
            this.loading.logs = true;
            await window.std(`/api/marti/missions/${this.mission.name}/log`, {
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
            await window.std(`/api/marti/missions/${this.mission.name}/upload/${file.hash}`, {
                method: 'DELETE'
            });

            this.fetchMission();
        },
        genConfig: function() {
            return {
                id: this.mission.name,
                token: localStorage.token
            }
        },
        fetchImports: async function() {
            try {
                const url = await window.stdurl(`/api/import`);
                url.searchParams.append('mode', 'Mission');
                url.searchParams.append('mode_id', this.mission.guid);
                this.imports = (await window.std(url)).imports;
            } catch (err) {
                this.err = err;
            }
            this.loading.users = false;
        },
        fetchContacts: async function() {
            try {
                this.loading.users = true;
                const url = await window.stdurl(`/api/marti/missions/${this.mission.name}/contacts`);
                if (this.connection) url.searchParams.append('connection', this.connection);
                this.contacts = await window.std(url);
            } catch (err) {
                this.err = err;
            }
            this.loading.users = false;
        },
        deleteMission: async function() {
            try {
                this.loading.delete = true;
                const url = window.stdurl(`/api/marti/missions/${this.mission.name}`);
                if (this.connection) url.searchParams.append('connection', this.connection);
                const list = await window.std(url, {
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
                const url = window.stdurl(`/api/marti/missions/${this.mission.name}`);
                url.searchParams.append('changes', 'true');
                url.searchParams.append('logs', 'true');
                if (this.connection) url.searchParams.append('connection', this.connection);
                const list = await window.std(url);
                if (list.data.length !== 1) throw new Error('Mission Error');
                this.mission = list.data[0];
            } catch (err) {
                this.err = err;
            }
            this.loading.initial = false;
            this.loading.mission = false;
        }
    },
    components: {
        Status,
        TablerNone,
        UploadImport,
        Alert,
        IconPlus,
        IconArticle,
        IconDownload,
        IconFiles,
        IconInfoSquare,
        IconUser,
        IconUsers,
        IconPencil,
        TablerLoading,
        TablerDelete,
        TablerInput,
        IconRefresh,
        IconLock,
        IconLockOpen
    }
}
</script>
