<template>
<div class='border py-2'>
    <div class='d-flex'>
        <h1 class='subheader px-3'>ESRI Server Explorer</h1>

        <div class='ms-auto btn-list mx-3'>
            <ArrowBackIcon v-if='!err && !loading && server' @click='back' v-tooltip='"Back"' class='cursor-pointer'/>
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
        <TablerLoading desc='Connecting to ESRI Server'/>
    </template>
    <template v-else-if='!server'>
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
    <template v-else-if='server && !container'>
        <template v-if='list.length === 0'>
            <None :compact='true' :create='false' label='Services'/>
        </template>
        <template v-else>
            <div class='table-responsive'>
                <table class="table table-hover card-table table-vcenter cursor-pointer">
                    <thead><tr><th>Name</th></tr></thead>
                    <tbody><tr @click='listpath.push(l)' :key='l.id' v-for='l in list'>
                        <td>
                            <template v-if='l.type === "folder"'>
                                <FolderIcon/>
                                <span v-text='l.name' class='mx-3'/>
                            </template>
                            <template v-else>
                                <MapIcon/>
                                <span v-text='l.name' class='mx-3'/>
                            </template>
                        </td>
                    </tr></tbody>
                </table>
            </div>
        </template>
    </template>
    <template v-else>
        <div class='datagrid mx-4'>
            <template v-for='ele in ["description", "currentVersion", "spatialReference"]'>
                <div class='datagrid-item'>
                    <div class="datagrid-title" v-text='ele'></div>
                    <template v-if='ele === "spatialReference"'>
                        <div class="datagrid-content"
                            v-text='`${container[ele].wkid} ${container[ele].latestWkid ? "(" + container[ele].latestWkid + ")" : ""}`'
                        ></div>
                    </template>
                    <template v-else>
                        <div class="datagrid-content" v-text='container[ele] || "Unknown"'></div>
                    </template>
                </div>
            </template>
        </div>

        <template v-if='container.layers.length === 0'>
            <None @create='createLayer' :compact='true' :create='true' label='Layers'/>
        </template>
        <template v-else>
            <div class='table-responsive'>
                <table class="table table-hover card-table table-vcenter cursor-pointer">
                    <thead><tr><th>Name</th></tr></thead>
                    <tbody><tr :key='layer.id' v-for='layer in container.layers'>
                        <td><MapIcon/><span v-text='layer.name' class='mx-3'/></td>
                    </tr></tbody>
                </table>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import None from '../cards/None.vue';
import {
    MapIcon,
    XIcon,
    FolderIcon,
    ArrowBackIcon,
} from 'vue-tabler-icons';
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
            err: null,
            token: null,
            server: null,
            listpath: [],
            servers: [],
            container: null
        }
    },
    watch: {
        server: async function() {
            if (this.server) await this.getList()
        },
        listpath: {
            deep: true,
            handler: async function() {
                await this.getList();
            }
        }
    },
    mounted: async function() {
        await this.generateToken();
    },
    methods: {
        back: function() {
            if (this.listpath.length) {
                this.listpath.pop();
            } else if (this.server) {
                this.server = null;
            }
        },
        createLayer: async function() {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri/layer');
                url.searchParams.append('token', this.token);
                if (this.listpath.length) {
                    const listpath = this.listpath.map((pth) => {
                        if (pth.type === 'folder') return pth.name;
                        return pth.name + '/' + pth.type;
                    }).join('/');
                    url.searchParams.append('url', this.server.url + '/rest/services/' + listpath);
                } else {
                    url.searchParams.append('url', this.server.url + '/rest');
                }

                await window.std(url, { method: 'POST' });

                await this.getList();
            } catch (err) {
                this.err = err;
            }
        },
        getList: async function() {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri');
                url.searchParams.append('token', this.token);
                if (this.listpath.length) {
                    const listpath = this.listpath.map((pth) => {
                        if (pth.type === 'folder') return pth.name;
                        return pth.name + '/' + pth.type;
                    }).join('/');
                    url.searchParams.append('url', this.server.url + '/rest/services/' + listpath);
                } else {
                    url.searchParams.append('url', this.server.url + '/rest');
                }

                const res = await window.std(url, {
                    method: 'GET',
                });

                if (Array.isArray(res.layers)) {
                    this.container = res;
                } else {
                    this.list = [].concat(res.folders.map((folder) => {
                        return { name: folder, type: 'folder' };
                    }), res.services.map((service) => {
                        return { name: service.name.split('/')[service.name.split('/').length -1], type: service.type };
                    })).map((e) => {
                        e.id = `${e.type}-${e.name}`;
                        return e;
                    });
                }
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
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
                this.servers = res.servers;
            } catch (err) {
                this.err = err;
            }
            this.loading = false;
        }
    },
    components: {
        Alert,
        XIcon,
        None,
        MapIcon,
        FolderIcon,
        ArrowBackIcon,
        TablerLoading
    }
}
</script>
