<template>
<div class='border py-2 mx-2'>
    <div class='d-flex'>
        <h1 class='subheader px-3' v-text='server'></h1>

        <div class='ms-auto btn-list mx-3'>
            <RefreshIcon v-if='!err && !loading' @click='getList' v-tooltip='"Refresh"' class='cursor-pointer'/>

            <ArrowBackIcon v-if='!err && !loading' @click='back' v-tooltip='"Back"' class='cursor-pointer'/>
        </div>
    </div>

    <template v-if='err'>
        <Alert title='ESRI Connection Error' :err='err.message' :compact='true'/>
        <div class="col-md-12 mt-3 pb-2 px-3">
        </div>
    </template>
    <template v-else-if='loading'>
        <TablerLoading desc='Connecting to ESRI Server'/>
    </template>
    <template v-else-if='!container'>
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
                    <tbody><tr @click='(layer && layer.id === lyr.id) ? layer = nulll : layer = lyr' :key='lyr.id' v-for='lyr in container.layers'>
                        <td>
                            <div class='d-flex'>
                                <MapIcon/><span v-text='lyr.name' class='mx-3'/>
                                <div class='ms-auto btn-list'>
                                    <CheckIcon v-if='layer && layer.id === lyr.id'/>
                                    <TablerDelete @delete='deleteLayer' displaytype='icon' label='Delete Layer'/>
                                </div>
                            </div>
                        </td>
                    </tr></tbody>
                </table>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import {
    TablerLoading,
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
import Alert from './Alert.vue';

export default {
    name: 'EsriServer',
    props: {
        portal: {
            type: String,
            required: true,
        },
        token: {
            type: String,
            required: true
        },
        server: {
            type: String,
            required: true
        },
    },
    data: function() {
        return {
            base: this.server,
            loading: true,
            err: null,
            listpath: [],
            container: null,
            layer: null,
        }
    },
    watch: {
        layer: function() {
            if (!this.layer) return this.$emit('layer', '');
            this.$emit('layer', this.stdurl());
        },
        listpath: {
            deep: true,
            handler: async function() {
                await this.getList();
            }
        }
    },
    mounted: async function() {
        this.base = this.base.replace(/\/rest\/services.*/, '');
        await this.getList();
    },
    methods: {
        back: function() {
            if (this.container) {
                this.layer = null;
                this.container = null;
                this.listpath.pop();
            } else if (this.listpath.length) {
                this.listpath.pop();
            } else {
                this.$emit('close');
            }
        },
        stdurl: function() {
            if (this.listpath.length) {
                const listpath = this.listpath.map((pth) => {
                    if (pth.type === 'folder') return pth.name;
                    return pth.name + '/' + pth.type;
                }).join('/');

                if (!this.layer) {
                    return this.base + '/rest/services/' + listpath;
                } else {
                    return this.base + '/rest/services/' + listpath + '/' + this.layer.id;
                }
            } else {
                return this.base + '/rest/services';
            }

        },
        createLayer: async function() {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri/server/layer');
                url.searchParams.append('token', this.token);
                url.searchParams.append('portal', this.portal);
                url.searchParams.append('server', this.stdurl());

                await window.std(url, { method: 'POST' });

                await this.getList();
            } catch (err) {
                this.err = err;
            }
        },
        deleteLayer: async function() {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri/server/layer');
                url.searchParams.append('token', this.token);
                url.searchParams.append('portal', this.portal);
                url.searchParams.append('server', this.stdurl());

                await window.std(url, { method: 'DELETE' });

                this.layer = null;

                await this.getList();
            } catch (err) {
                this.err = err;
            }
        },
        getList: async function() {
            this.loading = true;
            try {
                const url = window.stdurl('/api/sink/esri/server');
                url.searchParams.append('token', this.token);
                url.searchParams.append('server', this.stdurl());
                url.searchParams.append('portal', this.portal);

                const res = await window.std(url);

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
        TablerDelete
    }
}
</script>
