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

<script setup>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '/src/std.ts';
import {
    TablerAlert,
    TablerNone,
    TablerLoading,
    TablerDelete,
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconMap,
    IconFolder,
    IconRefresh,
    IconCheck,
    IconArrowBack,
} from '@tabler/icons-vue';

const props = defineProps({
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
});

const emit = defineEmits([
    'close',
    'layer'
]);

const base = ref(props.server);
const loading = ref(true);
const err = ref(null);
const listpath = ref([]);
const container = ref(null);
const list = ref([]);
const layer = ref(null);

watch(layer, () => {
    if (!layer.value) return emit('layer', '');
    emit('layer', stdurl_local(true));
});

watch(listpath, async () => {
    await getList();
}, { deep: true });

onMounted(async () => {
    base.value = base.value.replace(/\/rest\/services.*/, '');

    let postfix = props.server.replace(/^.*\/services\//, '');

    if (postfix.length && !postfix.startsWith('http')) {
        postfix = postfix.split('/');

        const last = postfix.pop();

        if (!isNaN(parseInt(last))) {
            const type = postfix.pop()
            listpath.value = [{ name: postfix.join('/'), type }]
            layer.value = { id: last };
        } else {
            listpath.value = [{ name: postfix.join('/'), type: last }]
        }
    } else {
        await getList();
    }
});

function back() {
    if (container.value) {
        layer.value = null;
        container.value = null;
        listpath.value.pop();
    } else if (listpath.value.length) {
        listpath.value.pop();
    } else {
        emit('close');
    }
}

function stdurl_local(use_layer=true) {
    if (listpath.value.length) {
        const path = listpath.value.map((pth) => {
            if (pth.type === 'folder') return pth.name;
            return pth.name + '/' + pth.type;
        }).join('/');

        if (!use_layer || !layer.value) {
            return base.value + '/rest/services/' + path;
        } else if (use_layer && layer.value) {
            return base.value + '/rest/services/' + path + '/' + layer.value.id;
        }
    } else {
        return base.value + '/rest/services';
    }

}

async function createLayer() {
    if (!props.token) throw new Error('Auth Token is required to create a service');

    loading.value = true;
    try {
        const url = stdurl('/api/esri/server/layer');
        url.searchParams.append('token', props.token.token);
        url.searchParams.append('expires', props.token.expires);
        if (props.portal) url.searchParams.append('portal', props.portal);
        url.searchParams.append('server', stdurl_local(false));

        await std(url, { method: 'POST' });

        await getList();
    } catch (error) {
        err.value = error;
    }
}

async function deleteLayer(l) {
    if (!props.token) throw new Error('Auth Token is required to create a service');

    loading.value = true;
    try {
        const url = stdurl('/api/esri/server/layer');
        if (props.token) url.searchParams.append('token', props.token.token);
        if (props.token) url.searchParams.append('expires', props.token.expires);
        if (props.portal) url.searchParams.append('portal', props.portal);
        url.searchParams.append('server', stdurl_local(false) + '/' + l.id);

        await std(url, { method: 'DELETE' });

        layer.value = null;

        await getList();
    } catch (error) {
        loading.value = false;
        throw error;
    }
}

async function getList() {
    loading.value = true;
    try {
        const url = stdurl('/api/esri/server');

        if (props.token) {
            url.searchParams.append('token', props.token.token);
            url.searchParams.append('expires', props.token.expires);
        }

        url.searchParams.append('server', stdurl_local(false));

        const res = await std(url);

        if (Array.isArray(res.layers)) {
            container.value = res;
        } else {
            list.value = [].concat(res.folders.map((folder) => {
                return { name: folder, type: 'folder' };
            }), res.services.map((service) => {
                return { name: service.name.split('/')[service.name.split('/').length -1], type: service.type };
            })).map((e) => {
                e.id = `${e.type}-${e.name}`;
                return e;
            });
        }
    } catch (error) {
        err.value = error;
    }
    loading.value = false;
}
</script>
