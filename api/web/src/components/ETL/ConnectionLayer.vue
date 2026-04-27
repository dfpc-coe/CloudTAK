<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <TablerLoading
            v-if='loading.layer || !layer || !stack'
            class='text-white'
            desc='Loading Layer'
        />
        <div
            v-else
            class='page-body'
        >
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='card-header'>
                                <LayerStatus :layer='layer' />

                                <a
                                    class='card-title cursor-pointer mx-2'
                                    @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${layer.id}`)'
                                    v-text='layer.name'
                                />

                                <TablerBadge
                                    v-if='layer.protected'
                                    class='ms-2'
                                    background-color='rgba(239, 68, 68, 0.2)'
                                    border-color='rgba(239, 68, 68, 0.5)'
                                    text-color='#dc2626'
                                >
                                    Protected
                                </TablerBadge>

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <TablerIconButton
                                            title='Download Config'
                                            @click='downloadConfig'
                                        >
                                            <IconDownload
                                                :size='32'
                                                stroke='1'
                                            />
                                        </TablerIconButton>
                                        <TablerIconButton
                                            title='Edit'
                                            @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${layer.id}/edit`)'
                                        >
                                            <IconPencil
                                                :size='32'
                                                stroke='1'
                                            />
                                        </TablerIconButton>
                                    </div>
                                </div>
                            </div>
                            <TablerMarkdown
                                class='card-body'
                                :markdown='layer.description'
                            />
                            <div class='card-footer d-flex align-items-center'>
                                <div>
                                    Last updated <span v-text='timeDiff(layer.updated)' />
                                </div>
                                <div class='ms-auto'>
                                    <InitialAuthor
                                        :email='layer.username || "Unknown"'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        v-if='softAlert && (!stack || (stack && !["CREATE_IN_PROGRESS"].includes(stack.status)))'
                        class='col-lg-12'
                    >
                        <div class='card'>
                            <div
                                class='bg-red-lt mx-2 px-2 py-2 my-2 rounded border border-red justify-content-center'
                            >
                                <div>Layer Capabilities could not be loaded from upstream source - Some functionality may not work until properly deployed &amp; configured</div>
                            </div>
                        </div>
                    </div>


                    <div class='col-lg-12'>
                        <div
                            v-if='loading.layer'
                            class='card'
                        >
                            <div class='card-body'>
                                <TablerLoading desc='Loading Layer' />
                            </div>
                        </div>
                        <div
                            v-else-if='loading.stack'
                            class='card'
                        >
                            <div class='card-body'>
                                <TablerLoading desc='Loading Stack Status' />
                            </div>
                        </div>
                        <div
                            v-else-if='stack && !stack.status.includes("_COMPLETE")'
                            class='card'
                        >
                            <div class='card-header d-flex align-items-center'>
                                <TablerLoading
                                    :inline='true'
                                    desc='Layer is updating'
                                />
                                <div class='ms-auto btn-list'>
                                    <IconX
                                        v-tooltip='"Cancel Stack Update"'
                                        class='cursor-pointer'
                                        :size='32'
                                        stroke='1'
                                        @click='cancelUpdate'
                                    />
                                </div>
                            </div>
                            <div class='card-body'>
                                <pre v-text='stack.status' />
                            </div>
                        </div>
                        <div
                            v-else
                            class='card'
                        >
                            <div class='row g-0'>
                                <div class='col-12 col-md-3 border-end'>
                                    <div class='card-body'>
                                        <h4 class='subheader'>
                                            Layer Settings
                                        </h4>
                                        <div
                                            role='menu'
                                            class='list-group list-group-transparent'
                                        >
                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "layer-deployment",
                                                    "cursor-pointer": route.name !== "layer-deployment"
                                                }'
                                                @keyup.enter='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/deployment`)'
                                                @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/deployment`)'
                                            ><IconPlaneDeparture
                                                :size='32'
                                                stroke='1'
                                            /><span class='mx-3'>Deployment</span></span>

                                            <span
                                                tabindex='0'
                                                role='menuitem'
                                                class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                :class='{
                                                    "active": route.name === "layer-alarm",
                                                    "cursor-pointer": route.name !== "layer-alarm"
                                                }'
                                                @keyup.enter='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/alarm`)'
                                                @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/alarm`)'
                                            ><IconAlarm
                                                 :size='32'
                                                 stroke='1'
                                             />
                                                <span class='mx-3'>Alarms</span>

                                                <div class='ms-auto'>
                                                    <TablerBadge
                                                        v-if='layer.priority === "high"'
                                                        style='height: 20px'
                                                        background-color='rgba(239, 68, 68, 0.2)'
                                                        border-color='rgba(239, 68, 68, 0.5)'
                                                        text-color='#dc2626'
                                                    >High Urgency</TablerBadge>
                                                    <TablerBadge
                                                        v-else-if='layer.priority === "low"'
                                                        style='height: 20px'
                                                        background-color='rgba(245, 158, 11, 0.2)'
                                                        border-color='rgba(245, 158, 11, 0.5)'
                                                        text-color='#d97706'
                                                    >Low Urgency</TablerBadge>
                                                    <TablerBadge
                                                        v-else
                                                        style='height: 20px'
                                                        background-color='rgba(107, 114, 128, 0.2)'
                                                        border-color='rgba(107, 114, 128, 0.5)'
                                                        text-color='#6b7280'
                                                    >Disabled</TablerBadge>
                                                </div>
                                            </span>

                                            <TablerPillGroup
                                                v-model='mode'
                                                :options='[
                                                    { value: "incoming", label: "Incoming" },
                                                    { value: "outgoing", label: "Outgoing" }
                                                ]'
                                                name='layer-direction'
                                            >
                                                <template #option='{ option }'>
                                                    <IconWorldDownload
                                                        v-if='option.value === "incoming"'
                                                        v-tooltip='"Incoming"'
                                                        :size='32'
                                                        stroke='1'
                                                    />
                                                    <IconWorldUpload
                                                        v-if='option.value === "outgoing"'
                                                        v-tooltip='"Outgoing"'
                                                        :size='32'
                                                        stroke='1'
                                                    />
                                                    {{ option.label }}
                                                </template>
                                            </TablerPillGroup>

                                            <template v-if='mode === "incoming"'>
                                                <TablerLoading
                                                    v-if='loading.incoming'
                                                    desc='Creating Config'
                                                />
                                                <TablerNone
                                                    v-else-if='!layer.incoming'
                                                    label='No Incoming Config'
                                                    :create='capabilities && capabilities.incoming !== undefined'
                                                    @create='createIncoming'
                                                />
                                                <template v-else>
                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-incoming-config",
                                                            "cursor-pointer": route.name !== "layer-incoming-config"
                                                        }'
                                                        @keyup.enter='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/incoming/config`)'
                                                        @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/incoming/config`)'
                                                    ><IconAdjustments
                                                        :size='32'
                                                        stroke='1'
                                                    /><span class='mx-3'>Config</span></span>

                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-incoming-environment",
                                                            "cursor-pointer": route.name !== "layer-incoming-environment"
                                                        }'
                                                        @keyup.enter='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/incoming/environment`)'
                                                        @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/incoming/environment`)'
                                                    ><IconBeach
                                                        :size='32'
                                                        stroke='1'
                                                    /><span class='mx-3'>Environment</span></span>
                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-incoming-schema",
                                                            "cursor-pointer": route.name !== "layer-incoming-schema"
                                                        }'
                                                        @keyup.enter='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/incoming/schema`)'
                                                        @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/incoming/schema`)'
                                                    ><IconSchema
                                                        :size='32'
                                                        stroke='1'
                                                    /><span class='mx-3'>Schema</span></span>
                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-incoming-styles",
                                                            "cursor-pointer": route.name !== "layer-incoming-styles"
                                                        }'
                                                        @keyup.enter='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/incoming/styles`)'
                                                        @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/incoming/styles`)'
                                                    ><IconPaint
                                                        :size='32'
                                                        stroke='1'
                                                    /><span class='mx-3'>Styling</span></span>
                                                    <div
                                                        class='list-group-item list-group-item-action d-flex align-items-center justify-content-center'
                                                    >
                                                        <TablerDelete
                                                            label='Delete Incoming'
                                                            @delete='deleteConfig("incoming")'
                                                        />
                                                    </div>
                                                </template>
                                            </template>
                                            <template v-else>
                                                <TablerLoading
                                                    v-if='loading.outgoing'
                                                    desc='Creating Config'
                                                />
                                                <TablerNone
                                                    v-else-if='!layer.outgoing'
                                                    label='No Outgoing Config'
                                                    :create='capabilities && capabilities.outgoing !== undefined'
                                                    @create='createOutgoing'
                                                />
                                                <template v-else>
                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-outgoing-config",
                                                            "cursor-pointer": route.name !== "layer-outgoing-config"
                                                        }'
                                                        @keyup.enter='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/outgoing/config`)'
                                                        @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/outgoing/config`)'
                                                    ><IconAdjustments
                                                        :size='32'
                                                        stroke='1'
                                                    /><span class='mx-3'>Config</span></span>

                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-outgoing-environment",
                                                            "cursor-pointer": route.name !== "layer-outgoing-environment"
                                                        }'
                                                        @keyup.enter='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/outgoing/environment`)'
                                                        @click='router.push(`/connection/${route.params.connectionid || "template"}/layer/${route.params.layerid}/outgoing/environment`)'
                                                    ><IconBeach
                                                        :size='32'
                                                        stroke='1'
                                                    /><span class='mx-3'>Environment</span></span>

                                                    <div
                                                        class='list-group-item list-group-item-action d-flex align-items-center justify-content-center'
                                                    >
                                                        <TablerDelete
                                                            label='Delete Outgoing'
                                                            @delete='deleteConfig("outgoing")'
                                                        />
                                                    </div>
                                                </template>
                                            </template>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9'>
                                    <router-view
                                        :key='route.fullPath'
                                        :layer='layer'
                                        :capabilities='capabilities'
                                        :stack='stack'
                                        @refresh='refresh(true)'
                                        @stack='fetchStatus(true)'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <PageFooter />
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import type { ETLLayer, ETLLayerTask, ETLLayerTaskCapabilities } from '../../types.ts';
import { server, std } from '../../std.ts';
import { useRoute, useRouter } from 'vue-router';
import PageFooter from '../PageFooter.vue';
import LayerStatus from './Layer/utils/StatusDot.vue';
import InitialAuthor from '../util/InitialAuthor.vue';
import timeDiff from '../../timediff.ts';
import {
    TablerBadge,
    TablerNone,
    TablerDelete,
    TablerBreadCrumb,
    TablerIconButton,
    TablerMarkdown,
    TablerLoading,
    TablerPillGroup
} from '@tak-ps/vue-tabler'
import {
    IconX,
    IconWorldDownload,
    IconWorldUpload,
    IconPencil,
    IconDownload,
    IconPlaneDeparture,
    IconAlarm,
    IconAdjustments,
    IconBeach,
    IconSchema,
    IconPaint,
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();

const mode = ref(String(route.name).includes('outgoing') ? 'outgoing' : 'incoming');
const softAlert = ref(false);
const loading = ref({
    layer: true,
    incoming: false,
    outgoing: false,
    stack: true
});
const stack = ref<ETLLayerTask | undefined>(undefined)
const layer = ref<ETLLayer | undefined>(undefined)
const capabilities = ref<ETLLayerTaskCapabilities | undefined>(undefined);
const looping = ref<ReturnType<typeof setInterval> | undefined>(undefined);

watch(stack, async (newStack, oldStack) => {
    if (
        oldStack
        && newStack
        && newStack.status.includes("_COMPLETE")
        && !oldStack.status.includes("_COMPLETE")
    ) {
        loading.value.layer = true;
        await fetch()
        loading.value.layer = false;
    }
});

onMounted(async () => {
    await refresh(true);

    looping.value = setInterval(async () => {
        await refresh(false);
    }, 10 * 1000);

    loading.value.layer = false;
});

onUnmounted(() => {
    if (looping.value) {
        clearInterval(looping.value);
    }
});

function layerPathParams(): { ':connectionid': 'template' | number; ':layerid': number } {
    return {
        ':connectionid': route.params.connectionid === 'template'
            ? 'template'
            : Number(String(route.params.connectionid)),
        ':layerid': Number(String(route.params.layerid))
    };
}

function numericLayerPathParams(): { ':connectionid': number; ':layerid': number } {
    return {
        ':connectionid': Number(String(route.params.connectionid)),
        ':layerid': Number(String(route.params.layerid))
    };
}

function throwIfError(error: { message: string } | undefined) {
    if (error) throw new Error(error.message);
}

async function refresh(full = false) {
    if (full) await fetch();
    await fetchStatus();
    await fetchCapabilities();
}

async function createOutgoing() {
    loading.value.outgoing = true;

    if (route.params.connectionid === 'template') {
        await std(`/api/connection/template/layer/${route.params.layerid}/outgoing`, {
            method: 'POST',
            body: {}
        });
    } else {
        const { error } = await server.POST('/api/connection/{:connectionid}/layer/{:layerid}/outgoing', {
            params: {
                path: numericLayerPathParams()
            },
            body: {}
        });

        throwIfError(error);
    }

    await fetch();
    await fetchStatus();

    loading.value.outgoing = false;
}

async function createIncoming() {
    loading.value.incoming = true;

    if (route.params.connectionid === 'template') {
        await std(`/api/connection/template/layer/${route.params.layerid}/incoming`, {
            method: 'POST',
            body: {}
        });
    } else {
        const { error } = await server.POST('/api/connection/{:connectionid}/layer/{:layerid}/incoming', {
            params: {
                path: numericLayerPathParams()
            },
            body: {}
        });

        throwIfError(error);
    }

    await fetch();
    await fetchStatus();

    loading.value.incoming = false;
}

async function fetch() {
    const { data, error } = await server.GET('/api/connection/{:connectionid}/layer/{:layerid}', {
        params: {
            path: layerPathParams(),
            query: {
                alarms: true,
                download: false
            }
        }
    });

    throwIfError(error);
    if (!data) throw new Error('Failed to load layer');
    layer.value = data;

    if (!String(route.name).includes('outgoing') && !String(route.name).includes('incoming')) {
        if (data.outgoing && !data.incoming) {
            mode.value = 'outgoing';
        }
    }
}

async function cancelUpdate() {
    const { error } = await server.DELETE('/api/connection/{:connectionid}/layer/{:layerid}/task', {
        params: {
            path: layerPathParams()
        }
    });

    throwIfError(error);
}

async function deleteConfig(direction: string) {
    loading.value.layer = true;

    if (route.params.connectionid === 'template') {
        await std(`/api/connection/template/layer/${route.params.layerid}/${direction}`, {
            method: 'DELETE'
        });
    } else if (direction === 'incoming') {
        const { error } = await server.DELETE('/api/connection/{:connectionid}/layer/{:layerid}/incoming', {
            params: {
                path: numericLayerPathParams()
            }
        });

        throwIfError(error);
    } else {
        const { error } = await server.DELETE('/api/connection/{:connectionid}/layer/{:layerid}/outgoing', {
            params: {
                path: numericLayerPathParams()
            }
        });

        throwIfError(error);
    }

    await fetch();
    await fetchStatus();

    router.push(`/connection/${route.params.connectionid || 'template'}/layer/${route.params.layerid}/deployment`);

    loading.value.layer = false;
}

async function fetchStatus(load = false) {
    loading.value.stack = load;
    const { data, error } = await server.GET('/api/connection/{:connectionid}/layer/{:layerid}/task', {
        params: {
            path: layerPathParams()
        }
    });

    throwIfError(error);
    if (!data) throw new Error('Failed to load task status');
    stack.value = data;
    loading.value.stack = false;
}

async function downloadConfig() {
    await std(`/api/connection/${route.params.connectionid || 'template'}/layer/${route.params.layerid}?download=true&token=${localStorage.token}`, {
        download: true
    });
}

async function fetchCapabilities() {
    try {
        const { data, error } = await server.GET('/api/connection/{:connectionid}/layer/{:layerid}/task/capabilities', {
            params: {
                path: layerPathParams()
            }
        });

        throwIfError(error);
        if (!data) throw new Error('Failed to load layer capabilities');
        capabilities.value = data;
        softAlert.value = false
    } catch (err) {
        softAlert.value = true;
        console.error(err);
    }
}
</script>
