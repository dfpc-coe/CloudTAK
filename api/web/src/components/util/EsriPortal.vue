<template>
<div class='border py-2'>
    <div class='d-flex'>
        <h1 class='subheader px-3'>
            ESRI Server Explorer
            <span v-if='portal && portal.name' v-text='" - " + portal.name'/>
        </h1>

        <div class='ms-auto btn-list mx-3'>
            <RefreshIcon v-if='!err && !loading' @click='generateToken' v-tooltip='"Refresh"' class='cursor-pointer'/>

            <PlusIcon v-if='!err && !loading' @click='createModal = true' v-tooltip='"Create Hosted Service"' class='cursor-pointer'/>
            <XIcon @click='$emit("close")' v-tooltip='"Close Explorer"' class='cursor-pointer'/>
        </div>
    </div>

    <template v-if='err'>
        <Alert title='ESRI Connection Error' :err='err.message' :compact='true'/>
        <div class="col-md-12 mt-3 pb-2 px-3">
            <div class='d-flex'>
                <div class='ms-auto'>
                    <a @click='$emit("close")' class="cursor-pointer btn btn-primary">Close Viewer</a>
                </div>
            </div>
        </div>
    </template>
    <template v-else-if='loading'>
        <TablerLoading desc='Connecting to ESRI Portal'/>
    </template>
    <template v-else-if='type === "SERVER" || server'>
        <template v-if='!server'>
            <template v-if='servers.length === 0'>
                <None :compact='true' :create='false' label='ArcGIS Servers'/>
            </template>
            <template v-else>
                <div class='table-responsive'>
                    <table class="table table-hover card-table table-vcenter cursor-pointer">
                        <thead><tr><th>ID</th><th>Name</th><th>Url</th></tr></thead>
                        <tbody><tr @click='server = serv' :key='serv.id' v-for='serv in servers'>
                            <td v-text='serv.id'></td>
                            <td v-text='serv.name'></td>
                            <td v-text='serv.url'></td>
                        </tr></tbody>
                    </table>
                </div>
            </template>
        </template>
        <template v-else>
            <div class='datagrid mx-4 my-4'>
                <template v-for='ele in ["id", "name", "adminUrl"]'>
                    <div class='datagrid-item'>
                        <div class="datagrid-title" v-text='ele'></div>
                        <div class="datagrid-content" v-text='server[ele] || "Unknown"'></div>
                    </div>
                </template>
            </div>

            <EsriServer
                :server='server.url'
                :portal='url'
                :token='token'
                @close='server = null'
            />
        </template>
    </template>
    <template v-else-if="type === 'AGOL'">
        <TablerInput placeholder='Filter by title' v-model='contentFilter.title'/>

        <div class='table-responsive'>
            <table class="table table-hover card-table table-vcenter cursor-pointer">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Attributes</th>
                    </tr>
                </thead>
                <tbody>
                    <tr @click='fmtserver(res)' :key='res.id' v-for='res in content.results'>
                        <td>
                            <MapIcon/>
                            <span v-text='res.title' class='mx-1'/>
                        </td>
                        <td>
                            <span v-text='res.access' class='badge mx-1 mb-1' :class='{
                                 "bg-green": res.access === "public"
                            }'/>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </template>

    <EsriPortalCreate
        v-if='createModal'
        :portal='url'
        :token='token'
        @close='createModal = false'
        @create='createService($event)'
    />
</div>
</template>

<script>
import {
    TablerLoading,
    TablerInput,
    TablerDelete
} from '@tak-ps/vue-tabler';
import None from '../cards/None.vue';
import {
    MapIcon,
    RefreshIcon,
    XIcon,
    PlusIcon,
    FolderIcon,
    ArrowBackIcon,
    CheckIcon
} from 'vue-tabler-icons';
import EsriServer from './EsriServer.vue';
import EsriPortalCreate from './EsriPortalCreate.vue';
import Alert from './Alert.vue';

export default {
    name: 'EsriProxy',
    props: {
        url: {
            type: [URL, String]
        },
        username: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        },
    },
    data: function() {
        return {
            loading: true,
            createModal: false,
            type: null,
            err: null,
            portal: null,
            token: null,
            server: null,
            servers: [],
            content: [],
            contentFilter: {
                title: ''
            }
        }
    },
    watch: {
        contentFilter: {
            deep: true,
            handler: async function() {
                await this.fetchContent();
            }
        }
    },
    mounted: async function() {
        await this.generateToken();
    },
    methods: {
        fmtserver: function(content) {
            this.server = content;
        },
        generateToken: async function() {
            this.loading = true;
            try {
                const res = await window.std('/api/sink/esri', {
                    method: 'POST',
                    body: {
                        username: this.username,
                        password: this.password,
                        url: this.url
                    }
                });

                this.token = res.token;
                this.type = res.type;

                await this.fetchPortal();

                if (this.type === 'AGOL') {
                    await this.fetchContent();
                } else {
                    await this.fetchServers();
                }
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        },
        fetchPortal: async function() {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri/portal');
                url.searchParams.append('token', this.token);
                url.searchParams.append('portal', this.url);

                const res = await window.std(url);

                this.portal = res;

                if (this.portal.isReadOnly) throw new Error('Portal is Read Only');
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        },
        fetchContent: async function() {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri/portal/content');
                url.searchParams.append('token', this.token);
                url.searchParams.append('portal', this.url);
                url.searchParams.append('title', this.contentFilter.title);

                const res = await window.std(url);

                this.content = res;
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        },
        fetchServers: async function() {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri/portal/server');
                url.searchParams.append('token', this.token);
                url.searchParams.append('portal', this.url);

                const res = await window.std(url);

                if (!res.servers) throw new Error('No Servers Present');
                this.servers = res.servers;
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        },
        createService: async function(body) {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri/portal/service');
                url.searchParams.append('token', this.token);
                url.searchParams.append('portal', this.url);

                const res = await window.std(url, { method: 'POST', body });

                const service = res.encodedServiceURL;

                this.server = {
                    url: service.replace(/\/rest\/services\/.*/, '/rest/services')
                };
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        },

    },
    components: {
        Alert,
        XIcon,
        PlusIcon,
        None,
        MapIcon,
        FolderIcon,
        RefreshIcon,
        CheckIcon,
        ArrowBackIcon,
        TablerLoading,
        TablerDelete,
        TablerInput,
        EsriServer,
        EsriPortalCreate
    }
}
</script>
