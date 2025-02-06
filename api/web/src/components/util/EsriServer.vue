<template>
    <div class='border py-2 mx-2'>
        <div class='d-flex'>
            <h1
                class='subheader px-3 col-9 text-truncate'
                v-text='server'
            />

            <div class='ms-auto btn-list mx-3'>
                <IconRefresh
                    v-if='!disabled && !err && !loading'
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='getList'
                />

                <IconArrowBack
                    v-if='!disabled && !err && !loading'
                    v-tooltip='"Back"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='back'
                />
                <IconX
                    v-if='!disabled'
                    v-tooltip='"Close Explorer"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='$emit("close")'
                />
            </div>
        </div>

        <template v-if='err'>
            <TablerAlert
                title='ESRI Connection Error'
                :err='err'
                :compact='true'
            />
        </template>
        <template v-else-if='loading'>
            <TablerLoading desc='Connecting to ESRI Server' />
        </template>
        <template v-else-if='!container'>
            <template v-if='list.length === 0'>
                <TablerNone
                    :compact='true'
                    :create='false'
                    label='Services'
                />
            </template>
            <template v-else>
                <div class='table-responsive'>
                    <table class='table table-hover card-table table-vcenter cursor-pointer'>
                        <thead><tr><th>Name</th></tr></thead>
                        <tbody>
                            <tr
                                v-for='l in list'
                                :key='l.id'
                                @click='listpath.push(l)'
                            >
                                <td>
                                    <div class='d-flex align-items-center'>
                                        <template v-if='l.type === "folder"'>
                                            <IconFolder
                                                :size='32'
                                                stroke='1'
                                            />
                                            <span
                                                class='mx-3'
                                                v-text='l.name'
                                            />
                                        </template>
                                        <template v-else>
                                            <IconMap
                                                :size='32'
                                                stroke='1'
                                            />
                                            <span
                                                class='mx-3'
                                                v-text='l.name'
                                            />
                                            <span
                                                class='ms-auto badge'
                                                v-text='l.type'
                                            />
                                        </template>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>
        </template>
        <template v-else>
            <div class='datagrid mx-4'>
                <template v-for='ele in ["description", "currentVersion", "spatialReference"]'>
                    <div class='datagrid-item'>
                        <div
                            class='datagrid-title'
                            v-text='ele'
                        />
                        <template v-if='ele === "spatialReference"'>
                            <div
                                class='datagrid-content'
                                v-text='`${container[ele].wkid} ${container[ele].latestWkid ? "(" + container[ele].latestWkid + ")" : ""}`'
                            />
                        </template>
                        <template v-else>
                            <div
                                class='datagrid-content'
                                v-text='container[ele] || "Unknown"'
                            />
                        </template>
                    </div>
                </template>
            </div>

            <template v-if='container.layers.length === 0'>
                <TablerNone
                    :compact='true'
                    :create='!disabled'
                    label='Layers'
                    @create='createLayer'
                />
            </template>
            <template v-else>
                <div class='table-responsive'>
                    <table
                        class='table card-table table-vcenter'
                        :class='{
                            "table-hover cursor-pointer": !disabled
                        }'
                    >
                        <thead><tr><th>Name</th></tr></thead>
                        <tbody>
                            <tr
                                v-for='lyr in container.layers'
                                :key='lyr.id'
                                @click='!disabled && (layer && layer.id === lyr.id) ? layer = nulll : layer = lyr'
                            >
                                <td>
                                    <div class='d-flex align-items-center'>
                                        <IconMap
                                            :size='32'
                                            stroke='1'
                                        /><span
                                            class='mx-3'
                                            v-text='lyr.name'
                                        />
                                        <div class='ms-auto btn-list'>
                                            <IconCheck
                                                v-if='layer && Number(layer.id) === lyr.id'
                                                :size='32'
                                                stroke='1'
                                            />
                                            <TablerDelete
                                                v-if='!readonly && !disabled'
                                                displaytype='icon'
                                                label='Delete Layer'
                                                @delete='deleteLayer(lyr)'
                                            />
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>
        </template>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerAlert,
    TablerLoading,
    TablerDelete,
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconMap,
    IconRefresh,
    IconX,
    IconFolder,
    IconArrowBack,
    IconCheck
} from '@tabler/icons-vue';

export default {
    name: 'EsriServer',
    components: {
        TablerAlert,
        IconX,
        TablerNone,
        IconMap,
        IconFolder,
        IconRefresh,
        IconCheck,
        IconArrowBack,
        TablerLoading,
        TablerDelete,
    },
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
    emits: [
        'close',
        'layer'
    ],
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

            const last = postfix.pop();

            if (!isNaN(parseInt(last))) {
                const type = postfix.pop()
                this.listpath = [{ name: postfix.join('/'), type }]
                this.layer = { id: last };
            } else {
                this.listpath = [{ name: postfix.join('/'), type: last }]
            }
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
                const url = stdurl('/api/esri/server/layer');
                url.searchParams.append('token', this.token.token);
                url.searchParams.append('expires', this.token.expires);
                if (this.portal) url.searchParams.append('portal', this.portal);
                url.searchParams.append('server', this.stdurl(false));

                await std(url, { method: 'POST' });

                await this.getList();
            } catch (err) {
                this.err = err;
            }
        },
        deleteLayer: async function(layer) {
            if (!this.token) throw new Error('Auth Token is required to create a service');

            this.loading = true;
            try {
                const url = stdurl('/api/esri/server/layer');
                if (this.token) url.searchParams.append('token', this.token.token);
                if (this.token) url.searchParams.append('expires', this.token.expires);
                if (this.portal) url.searchParams.append('portal', this.portal);
                url.searchParams.append('server', this.stdurl(false) + '/' + layer.id);

                await std(url, { method: 'DELETE' });

                this.layer = null;

                await this.getList();
            } catch (err) {
                this.loading = false;
                throw err;
            }
        },
        getList: async function() {
            this.loading = true;
            try {
                const url = stdurl('/api/esri/server');

                if (this.token) {
                    url.searchParams.append('token', this.token.token);
                    url.searchParams.append('expires', this.token.expires);
                }

                url.searchParams.append('server', this.stdurl(false));

                const res = await std(url);

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
    }
}
</script>
