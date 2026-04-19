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
        <template v-else-if='!url && server'>
            <!-- If no url is given assume auth is directly with a Server-->
            <EsriServer
                :disabled='disabled'
                :server='server.url'
                :readonly='readonly'
                :token='token ?? undefined'
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
                                label='No ArcGIS Servers'
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
                            :server='server?.url ?? ""'
                            :readonly='readonly'
                            :portal='String(url ?? "")'
                            :token='token ?? undefined'
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

                    <TablerLoading
                        v-if='loading.content'
                        desc='Searching Content'
                    />
                    <TablerNone
                        v-else-if='content.total === 0'
                        :create='false'
                        label='No Content Items'
                    />
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
                                        <TablerBadge
                                            class='mx-1 mb-1'
                                            :background-color='res.access === "public" ? "rgba(34, 197, 94, 0.2)" : res.access === "org" ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)"'
                                            :border-color='res.access === "public" ? "rgba(34, 197, 94, 0.5)" : res.access === "org" ? "rgba(245, 158, 11, 0.5)" : "rgba(239, 68, 68, 0.5)"'
                                            :text-color='res.access === "public" ? "#16a34a" : res.access === "org" ? "#d97706" : "#dc2626"'
                                        >
                                            {{ res.access }}
                                        </TablerBadge>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </template>

                <EsriPortalCreate
                    v-if='createModal'
                    :portal='String(url ?? "")'
                    :token='token?.token ?? ""'
                    @close='createModal = false'
                    @create='createService($event)'
                />
            </div>
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
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconX,
    IconPlus,
    IconMap,
    IconRefresh,
} from '@tabler/icons-vue';
import EsriServer from './EsriServer.vue';
import EsriPortalCreate from './EsriPortalCreate.vue';

interface EsriToken {
    token: string;
    expires: string;
}

interface EsriServerItem {
    id?: string | number;
    name?: string;
    url: string;
    title?: string;
    [key: string]: unknown;
}

interface ContentItem {
    id: string;
    title: string;
    access: string;
    url?: string;
    [key: string]: unknown;
}

const props = withDefaults(defineProps<{
    disabled?: boolean;
    readonly?: boolean;
    url?: string | URL;
    layer?: string | URL;
    username?: string;
    password?: string;
    pane?: boolean;
}>(), {
    disabled: false,
    readonly: false,
    url: undefined,
    layer: undefined,
    username: undefined,
    password: undefined,
    pane: true,
});

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'token', token: EsriToken | null): void;
    (e: 'layer', layer: string): void;
}>();

const loading = ref({
    main: true,
    content: true
});
const createModal = ref<boolean>(false);
const type = ref<string | null>(null);
const err = ref<Error | null>(null);
const portal = ref<Record<string, unknown> | null>(null);
const token = ref<EsriToken | null>(null);
const server = ref<EsriServerItem | null>(props.layer ? { url: String(props.layer) } : null);
const servers = ref<EsriServerItem[]>([]);
const content = ref<{ total?: number; results?: ContentItem[] }>({});
const contentFilter = ref({
    title: ''
});

watch(server, async () => {
    if (type.value === 'AGOL') {
        await fetchContent();
    } else {
        await fetchServers();
    }
});

watch(token, () => {
    emit('token', token.value);
});

watch(contentFilter, async () => {
    await fetchContent();
}, { deep: true });

onMounted(async () => {
    if (props.username && props.password) {
        await generateToken();
    }
});

function fmtserver(c: ContentItem | EsriServerItem) {
    server.value = {
        ...c,
        url: c.url ?? ''
    };
}

async function generateToken() {
    loading.value.main = true;
    try {
        const body = {
            username: props.username,
            password: props.password,
            url: props.url || server.value?.url
        }

        const res = await std('/api/esri', {
            method: 'POST',
            body
        }) as { auth: EsriToken; type: string };

        token.value = res.auth;
        type.value = res.type;

        if (type.value === 'AGOL') {
            await fetchPortal();
            await fetchContent();
        } else if (type.value === 'PORTAL') {
            await fetchPortal();
            await fetchServers();
        }
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value.main = false;
}

async function fetchPortal() {
    loading.value.main = true;
    try {
        const url = stdurl('/api/esri/portal');
        if (token.value) {
            url.searchParams.set('token', token.value.token);
            url.searchParams.set('expires', token.value.expires);
        }

        url.searchParams.set('portal', String(props.url));

        const res = await std(url) as Record<string, unknown>;

        portal.value = res;

        if (portal.value.isReadOnly) throw new Error('Portal is Read Only');
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value.main = false;
}

async function fetchContent() {
    loading.value.content = true;
    try {
        const url = stdurl('/api/esri/portal/content');
        if (token.value) {
            url.searchParams.set('token', token.value.token);
            url.searchParams.set('expires', token.value.expires);
        }
        url.searchParams.set('portal', String(props.url));
        url.searchParams.set('title', contentFilter.value.title);

        const res = await std(url) as { total?: number; results?: ContentItem[] };

        content.value = res;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value.content = false;
}

async function fetchServers() {
    loading.value.main = true;
    try {
        const url = stdurl('/api/esri/portal/server');
        if (token.value) {
            url.searchParams.set('token', token.value.token);
            url.searchParams.set('expires', token.value.expires);
        }
        url.searchParams.set('portal', String(props.url));

        const res = await std(url) as { servers?: EsriServerItem[] };

        if (!res.servers) throw new Error('No Servers Present');
        servers.value = res.servers;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value.main = false;
}

async function createService(body: Record<string, unknown>) {
    if (!token.value) throw new Error('Auth Token is required to create a service');

    loading.value.main = true;
    try {
        const url = stdurl('/api/esri/portal/service');
        url.searchParams.set('token', token.value.token);
        url.searchParams.set('expires', token.value.expires);
        url.searchParams.set('portal', String(props.url));

        const res = await std(url, { method: 'POST', body }) as { encodedServiceURL: string };

        server.value = {
            url: res.encodedServiceURL
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value.main = false;
}
</script>
