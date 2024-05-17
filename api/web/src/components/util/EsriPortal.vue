<template>
<div class='row col-12'>
    <template v-if='err'>
        <TablerAlert title='ESRI Connection Error' :err='err' :compact='true'/>
        <div class="col-md-12 mt-3 pb-2 px-3">
            <div class='d-flex'>
                <div class='ms-auto'>
                    <a v-if='pane' @click='$emit("close")' class="cursor-pointer btn btn-primary">Close Viewer</a>
                </div>
            </div>
        </div>
    </template>
    <template v-else-if='loading.main'>
        <TablerLoading desc='Connecting to ESRI Portal'/>
    </template>
    <template v-else-if='!url'> <!-- If no url is given assume auth is directly with a Server-->
        <EsriServer
            :disabled='disabled'
            :server='server.url'
            :readonly='readonly'
            :token='token'
            @layer='$emit("layer", $event)'
            @close='server = null'
        />
    </template>
    <template v-else>
        <div class='py-2' :class='{
            "border": pane
        }'>
            <div class='d-flex'>
                <h1 class='subheader px-3'>
                    ESRI Portal Explorer
                    <span v-if='portal && portal.name' v-text='" - " + portal.name'/>
                </h1>

                <div class='ms-auto btn-list mx-3'>
                    <IconRefresh v-if='!disabled && !err && !loading.main' @click='generateToken' v-tooltip='"Refresh"' size='32' class='cursor-pointer'/>

                    <IconPlus v-if='!readonly && !disabled && !err && !loading.main' @click='createModal = true' v-tooltip='"Create Hosted Service"' size='32' class='cursor-pointer'/>
                    <IconX v-if='pane && !disabled' @click='$emit("close")' v-tooltip='"Close Explorer"' size='32' class='cursor-pointer'/>
                </div>
            </div>

            <template v-if='type === "PORTAL" || server'>
                <template v-if='!server'>
                    <template v-if='servers.length === 0'>
                        <TablerNone :compact='true' :create='false' label='ArcGIS Servers'/>
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
                    <div class='datagrid'>
                        <template v-for='ele in ["id", "name", "adminUrl"]'>
                            <div v-if='server[ele]' class='datagrid-item'>
                                <div class="datagrid-title" v-text='ele'></div>
                                <div class="datagrid-content" v-text='server[ele]'></div>
                            </div>
                        </template>
                    </div>

                    <EsriServer
                        :disabled='disabled'
                        :server='server.url'
                        :readonly='readonly'
                        :portal='url'
                        :token='token'
                        @layer='$emit("layer", $event)'
                        @close='server = null'
                    />
                </template>
            </template>
            <template v-else-if="type === 'AGOL'">
                <TablerInput placeholder='Filter by Title' v-model='contentFilter.title'/>

                <template v-if='loading.content'>
                    <TablerLoading desc='Searching Content'/>
                </template>
                <div v-else class='table-responsive'>
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
                                    <IconMap size='32'/>
                                    <span v-text='res.title' class='mx-1'/>
                                </td>
                                <td>
                                    <span v-text='res.access' class='badge mx-1 mb-1' :class='{
                                         "bg-green text-white": res.access === "public",
                                         "bg-yellow text-white": res.access === "org",
                                         "bg-red text-white": res.access === "private"
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
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerAlert,
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconMap,
    IconRefresh,
    IconX,
    IconPlus,
} from '@tabler/icons-vue';
import EsriServer from './EsriServer.vue';
import EsriPortalCreate from './EsriPortalCreate.vue';

export default {
    name: 'EsriProxy',
    props: {
        disabled: {
            type: Boolean,
            required: false,
            default: false
        },
        readonly: {
            type: Boolean,
            default: false,
            description: 'Hide buttons for CRUD Operations'
        },
        url: {
            type: [URL, String],
            description: 'ArcGIS Portal URL to authenticate against'
        },
        layer: {
            type: [URL, String],
            description: 'ArcGIS Server/Layer URL'
        },
        sinkid: {
            type: Number
        },
        username: {
            type: String,
        },
        password: {
            type: String,
        },
        pane: {
            type: Boolean,
            default: true
        }
    },
    data: function() {
        return {
            loading: {
                main: true,
                content: true
            },
            createModal: false,
            type: null,
            err: null,
            portal: null,
            token: null,
            server: this.layer ? { url: this.layer } : null,
            servers: [],
            content: [],
            contentFilter: {
                title: ''
            }
        }
    },
    watch: {
        server: async function() {
            if (this.type === 'AGOL') {
                await this.fetchContent();
            } else {
                await this.fetchServers();
            }
        },
        token: function() {
            this.$emit('token', this.token);
        },
        contentFilter: {
            deep: true,
            handler: async function() {
                await this.fetchContent();
            }
        }
    },
    mounted: async function() {
        if ((this.username && this.password) || this.sinkid) await this.generateToken();
    },
    methods: {
        fmtserver: function(content) {
            this.server = content;
        },
        generateToken: async function() {
            this.loading.main = true;
            try {
                const body = {
                    username: this.username,
                    password: this.password,
                    sinkid: this.sinkid,
                    url: this.url || this.server.url
                }

                const res = await std('/api/esri', {
                    method: 'POST',
                    body
                });

                this.token = res.auth;
                this.type = res.type;

                if (this.type === 'AGOL') {
                    await this.fetchPortal();
                    await this.fetchContent();
                } else if (this.type === 'PORTAL') {
                    await this.fetchPortal();
                    await this.fetchServers();
                }
            } catch (err) {
                this.err = err;
            }
            this.loading.main = false;
        },
        fetchPortal: async function() {
            this.loading.main = true;
            try {
                const url = stdurl('/api/esri/portal');
                if (this.token) {
                    url.searchParams.append('token', this.token.token);
                    url.searchParams.append('expires', this.token.expires);
                }

                url.searchParams.append('portal', this.url);

                const res = await std(url);

                this.portal = res;

                if (this.portal.isReadOnly) throw new Error('Portal is Read Only');
            } catch (err) {
                this.err = err;
            }
            this.loading.main = false;
        },
        fetchContent: async function() {
            this.loading.content = true;
            try {
                const url = stdurl('/api/esri/portal/content');
                if (this.token) {
                    url.searchParams.append('token', this.token.token);
                    url.searchParams.append('expires', this.token.expires);
                }
                url.searchParams.append('portal', this.url);
                url.searchParams.append('title', this.contentFilter.title);

                const res = await std(url);

                this.content = res;
            } catch (err) {
                this.err = err;
            }
            this.loading.content = false;
        },
        fetchServers: async function() {
            this.loading.main = true;
            try {
                const url = stdurl('/api/esri/portal/server');
                if (this.token) {
                    url.searchParams.append('token', this.token.token);
                    url.searchParams.append('expires', this.token.expires);
                }
                url.searchParams.append('portal', this.url);

                const res = await std(url);

                if (!res.servers) throw new Error('No Servers Present');
                this.servers = res.servers;
            } catch (err) {
                this.err = err;
            }
            this.loading.main = false;
        },
        createService: async function(body) {
            if (!this.token) throw new Error('Auth Token is required to create a service');

            this.loading.main = true;
            try {
                const url = stdurl('/api/esri/portal/service');
                url.searchParams.append('token', this.token.token);
                url.searchParams.append('expires', this.token.expires);
                url.searchParams.append('portal', this.url);

                const res = await std(url, { method: 'POST', body });

                this.server = {
                    url: res.encodedServiceURL
                };
            } catch (err) {
                this.err = err;
            }
            this.loading.main = false;
        },

    },
    components: {
        TablerAlert,
        IconX,
        IconPlus,
        TablerNone,
        IconMap,
        IconRefresh,
        TablerLoading,
        TablerInput,
        EsriServer,
        EsriPortalCreate
    }
}
</script>
