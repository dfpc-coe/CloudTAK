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
                    label='No Services'
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
                                            <TablerBadge
                                                class='ms-auto'
                                                background-color='rgba(107, 114, 128, 0.2)'
                                                border-color='rgba(107, 114, 128, 0.5)'
                                                text-color='#6b7280'
                                            >
                                                {{ l.type }}
                                            </TablerBadge>
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
                                v-text='`${(container[ele] as Record<string, unknown>)?.wkid} ${(container[ele] as Record<string, unknown>)?.latestWkid ? "(" + (container[ele] as Record<string, unknown>)?.latestWkid + ")" : ""}`'
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
                    label='No Layers'
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
                                @click='!disabled && (layer && layer.id === lyr.id) ? layer = null : layer = lyr'
                            >
                                <td>
                                    <div class='d-flex align-items-center'>
                                        <IconMapPin
                                            v-if='lyr.geometryType === "esriGeometryPoint"'
                                            :size='32'
                                            stroke='1'
                                        />
                                        <IconLine
                                            v-else-if='lyr.geometryType === "esriGeometryPolyline"'
                                            :size='32'
                                            stroke='1'
                                        />
                                        <IconPolygon
                                            v-else-if='lyr.geometryType === "esriGeometryPolygon"'
                                            :size='32'
                                            stroke='1'
                                        />
                                        <IconMap
                                            v-else
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

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../std.ts';
import {
    TablerAlert,
    TablerBadge,
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
    IconMapPin,
    IconLine,
    IconPolygon,
} from '@tabler/icons-vue';

interface EsriToken {
    token: string;
    expires: string;
}

interface PathItem {
    name: string;
    type: string;
}

interface ListItem {
    id: string;
    name: string;
    type: string;
}

interface LayerItem {
    id: string | number;
    name: string;
    geometryType?: string;
    [key: string]: unknown;
}

interface ContainerType {
    layers: LayerItem[];
    spatialReference?: { wkid?: number; latestWkid?: number };
    [key: string]: unknown;
}

const props = withDefaults(defineProps<{
    disabled?: boolean;
    readonly?: boolean;
    portal?: string;
    token?: EsriToken;
    server: string;
}>(), {
    disabled: false,
    readonly: false,
    portal: undefined,
    token: undefined,
});

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'layer', layer: string): void;
}>();

const base = ref<string>(props.server);
const loading = ref<boolean>(true);
const err = ref<Error | null>(null);
const listpath = ref<PathItem[]>([]);
const container = ref<ContainerType | null>(null);
const list = ref<ListItem[]>([]);
const layer = ref<{ id: string | number } | null>(null);

watch(layer, () => {
    if (!layer.value) return emit('layer', '');
    emit('layer', stdurl_local(true) as string);
});

watch(listpath, async () => {
    await getList();
}, { deep: true });

onMounted(async () => {
    base.value = base.value.replace(/\/rest\/services.*/, '');

    let postfix = props.server.replace(/^.*\/services\//, '');

    if (postfix.length && !postfix.startsWith('http')) {
        const parts = postfix.split('/');

        const last = parts.pop()!;

        if (!isNaN(parseInt(last))) {
            const type = parts.pop()!
            listpath.value = [{ name: parts.join('/'), type }]
            layer.value = { id: last };
        } else {
            listpath.value = [{ name: parts.join('/'), type: last }]
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

function stdurl_local(use_layer=true): string | undefined {
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
        url.searchParams.set('token', props.token.token);
        url.searchParams.set('expires', props.token.expires);
        if (props.portal) url.searchParams.set('portal', props.portal);
        url.searchParams.set('server', stdurl_local(false) as string);

        await std(url, { method: 'POST' });

        await getList();
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
}

async function deleteLayer(l: LayerItem) {
    if (!props.token) throw new Error('Auth Token is required to create a service');

    loading.value = true;
    try {
        const url = stdurl('/api/esri/server/layer');
        if (props.token) url.searchParams.set('token', props.token.token);
        if (props.token) url.searchParams.set('expires', props.token.expires);
        if (props.portal) url.searchParams.set('portal', props.portal);
        url.searchParams.set('server', stdurl_local(false) + '/' + l.id);

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
            url.searchParams.set('token', props.token.token);
            url.searchParams.set('expires', props.token.expires);
        }

        url.searchParams.set('server', stdurl_local(false) as string);

        const res = await std(url) as Record<string, unknown>;

        if (Array.isArray((res as { layers?: unknown[] }).layers)) {
            container.value = res as ContainerType;
        } else {
            const resTyped = res as { folders: string[]; services: { name: string; type: string }[] };
            list.value = ([] as ListItem[]).concat(resTyped.folders.map((folder: string) => {
                return { id: `folder-${folder}`, name: folder, type: 'folder' };
            }), resTyped.services.map((service: { name: string; type: string }) => {
                return { id: `${service.type}-${service.name.split('/')[service.name.split('/').length -1]}`, name: service.name.split('/')[service.name.split('/').length -1], type: service.type };
            }));
        }
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}
</script>
