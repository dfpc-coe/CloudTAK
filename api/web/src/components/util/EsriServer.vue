<template>
<div class='border py-2 mx-2'>
    <div class='d-flex'>
        <h1 class='subheader px-3 col-9 text-truncate' v-text='server'></h1>

        <div class='ms-auto btn-list mx-3'>
            <RefreshIcon v-if='!disabled && !err && !loading' @click='getList' v-tooltip='"Refresh"' class='cursor-pointer'/>

            <ArrowBackIcon v-if='!disabled && !err && !loading' @click='back' v-tooltip='"Back"' class='cursor-pointer'/>
            <XIcon v-if='!disabled' @click='$emit("close")' v-tooltip='"Close Explorer"' class='cursor-pointer'/>
        </div>
    </div>

    <template v-if='err'>
        <Alert title='ESRI Connection Error' :err='err.message' :compact='true'/>
    </template>
    <template v-else-if='loading'>
        <TablerLoading desc='Connecting to ESRI Server'/>
    </template>
    <template v-else-if='!container'>
        <template v-if='list.length === 0'>
            <TablerNone :compact='true' :create='false' label='Services'/>
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
            <TablerNone @create='createLayer' :compact='true' :create='!disabled' label='Layers'/>
        </template>
        <template v-else>
            <div class='table-responsive'>
                <table class="table card-table table-vcenter" :class='{
                    "table-hover cursor-pointer": !disabled
                }'>
                    <thead><tr><th>Name</th></tr></thead>
                    <tbody><tr @click='!disabled && (layer && layer.id === lyr.id) ? layer = nulll : layer = lyr' :key='lyr.id' v-for='lyr in container.layers'>
                        <td>
                            <div class='d-flex'>
                                <MapIcon/><span v-text='lyr.name' class='mx-3'/>
                                <div class='ms-auto btn-list'>
                                    <CheckIcon v-if='layer && layer.id === lyr.id'/>
                                    <TablerDelete v-if='!readonly && !disabled' @delete='deleteLayer' displaytype='icon' label='Delete Layer'/>
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
    TablerDelete,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    MapIcon,
    RefreshIcon,
    XIcon,
    FolderIcon,
    ArrowBackIcon,
    CheckIcon
} from 'vue-tabler-icons';
import Alert from './Alert.vue';

export default {
    name: 'EsriServer',
    props: {
        disabled: {
            type: Boolean,
            required: false,
            default: false
        },
        readonly: {
            type: Boolean,
            default: false
        },
        portal: {
            type: String,
        },
        token: {
            type: Object,
        },
        server: {
            type: String,
            required: true
        },
    },
    data: function() {
        return {
            base: this.server,
            filterModal: false,
            loading: true,
            err: null,
            listpath: [],
            container: null,
            list: [],
            layer: null,
        }
    },
    watch: {
        layer: function() {
            if (!this.layer) return this.$emit('layer', '');
            this.$emit('layer', this.stdurl(true));
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

        let postfix = this.server.replace(/^.*\/services\//, '');

        if (postfix.length && !postfix.startsWith('http')) {
            // TODO Support Directories / Layer Parsing
            postfix = postfix.split('/');

            this.listpath = [{
                name: postfix[0],
                type: postfix[1]
            }]

            this.layer = {
                id: parseInt(postfix[2])
            };

        } else {
            await this.getList();
        }
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
        stdurl: function(layer=true) {
            if (this.listpath.length) {
                const listpath = this.listpath.map((pth) => {
                    if (pth.type === 'folder') return pth.name;
                    return pth.name + '/' + pth.type;
                }).join('/');

                if (!layer || !this.layer) {
                    return this.base + '/rest/services/' + listpath;
                } else if (layer && this.layer) {
                    return this.base + '/rest/services/' + listpath + '/' + this.layer.id;
                }
            } else {
                return this.base + '/rest/services';
            }

        },
        createLayer: async function() {
            if (!this.token) throw new Error('Auth Token is required to create a service');

            this.loading = true;
            try {
                const url = window.stdurl('/api/esri/server/layer');
                url.searchParams.append('token', this.token.token);
                url.searchParams.append('expires', this.token.expires);
                if (this.portal) url.searchParams.append('portal', this.portal);
                url.searchParams.append('server', this.stdurl());

                await window.std(url, { method: 'POST' });

                await this.getList();
            } catch (err) {
                this.err = err;
            }
        },
        deleteLayer: async function() {
            if (!this.token) throw new Error('Auth Token is required to create a service');

            this.loading = true;
            try {
                const url = window.stdurl('/api/esri/server/layer');
                if (this.token) url.searchParams.append('token', this.token.token);
                if (this.token) url.searchParams.append('expires', this.token.expires);
                if (this.portal) url.searchParams.append('portal', this.portal);
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
                const url = window.stdurl('/api/esri/server');

                if (this.token) {
                    url.searchParams.append('token', this.token.token);
                    url.searchParams.append('expires', this.token.expires);
                }

                url.searchParams.append('server', this.stdurl(false));

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
        TablerNone,
        MapIcon,
        FolderIcon,
        RefreshIcon,
        CheckIcon,
        ArrowBackIcon,
        TablerLoading,
        TablerDelete,
    }
}
</script>
