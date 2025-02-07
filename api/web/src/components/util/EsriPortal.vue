<template>
    <div class='row col-12'>
        <template v-if='err'>
            <TablerAlert
                title='ESRI Connection Error'
                :err='err'
                :compact='true'
            />
            <div class='col-md-12 mt-3 pb-2 px-3'>
                <div class='d-flex'>
                    <div class='ms-auto'>
                        <a
                            v-if='pane'
                            class='cursor-pointer btn btn-primary'
                            @click='$emit("close")'
                        >Close Viewer</a>
                    </div>
                </div>
            </div>
        </template>
        <template v-else-if='loading.main'>
            <TablerLoading desc='Connecting to ESRI Portal' />
        </template>
        <template v-else-if='!url'>
            <!-- If no url is given assume auth is directly with a Server-->
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
            <div
                class='py-2'
                :class='{
                    "border": pane
                }'
            >
                <div class='d-flex'>
                    <h1 class='subheader px-3'>
                        ESRI Portal Explorer
                        <span
                            v-if='portal && portal.name'
                            v-text='" - " + portal.name'
                        />
                    </h1>

                    <div class='ms-auto btn-list mx-3'>
                        <IconRefresh
                            v-if='!disabled && !err && !loading.main'
                            v-tooltip='"Refresh"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='generateToken'
                        />

                        <IconPlus
                            v-if='!readonly && !disabled && !err && !loading.main'
                            v-tooltip='"Create Hosted Service"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='createModal = true'
                        />
                        <IconX
                            v-if='pane && !disabled'
                            v-tooltip='"Close Explorer"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='$emit("close")'
                        />
                    </div>
                </div>

                <template v-if='type === "PORTAL" || server'>
                    <template v-if='!server'>
                        <template v-if='servers.length === 0'>
                            <TablerNone
                                :compact='true'
                                :create='false'
                                label='ArcGIS Servers'
                            />
                        </template>
                        <template v-else>
                            <div class='table-responsive'>
                                <table class='table table-hover card-table table-vcenter cursor-pointer'>
                                    <thead><tr><th>ID</th><th>Name</th><th>Url</th></tr></thead>
                                    <tbody>
                                        <tr
                                            v-for='serv in servers'
                                            :key='serv.id'
                                            @click='server = serv'
                                        >
                                            <td v-text='serv.id' />
                                            <td v-text='serv.name' />
                                            <td v-text='serv.url' />
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </template>
                    </template>
                    <template v-else>
                        <div class='datagrid'>
                            <template v-for='ele in ["id", "name", "adminUrl"]'>
                                <div
                                    v-if='server[ele]'
                                    class='datagrid-item'
                                >
                                    <div
                                        class='datagrid-title'
                                        v-text='ele'
                                    />
                                    <div
                                        class='datagrid-content'
                                        v-text='server[ele]'
                                    />
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
                <template v-else-if='type === &apos;AGOL&apos;'>
                    <TablerInput
                        v-model='contentFilter.title'
                        placeholder='Filter by Title'
                    />

                    <template v-if='loading.content'>
                        <TablerLoading desc='Searching Content' />
                    </template>
                    <div
                        v-else
                        class='table-responsive'
                    >
                        <table class='table table-hover card-table table-vcenter cursor-pointer'>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Attributes</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for='res in content.results'
                                    :key='res.id'
                                    @click='fmtserver(res)'
                                >
                                    <td>
                                        <IconMap
                                            :size='32'
                                            stroke='1'
                                        />
                                        <span
                                            class='mx-1'
                                            v-text='res.title'
                                        />
                                    </td>
                                    <td>
                                        <span
                                            class='badge mx-1 mb-1'
                                            :class='{
                                                "bg-green text-white": res.access === "public",
                                                "bg-yellow text-white": res.access === "org",
                                                "bg-red text-white": res.access === "private"
                                            }'
                                            v-text='res.access'
                                        />
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
    },
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
    emits: [
        'close',
        'token',
        'layer'
    ],
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

    }
}
</script>
