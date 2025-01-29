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
            v-if='loading.layer'
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
                                    @click='router.push(`/connection/${route.params.connectionid}/layer/${layer.id}`)'
                                    v-text='layer.name'
                                />

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <TablerIconButton
                                            title='Layer Alerts'
                                            @click='router.push(`/connection/${route.params.connectionid}/layer/${layer.id}/alert`)'
                                        ><IconAlertTriangle :size='32' stroke='1' :class='{ "text-red": alerts.total }' /></TablerIconButton>
                                        <TablerIconButton
                                            title='Edit'
                                            @click='router.push(`/connection/${route.params.connectionid}/layer/${layer.id}/edit`)'
                                        > <IconPencil :size='32' :stroke='1' /></TablerIconButton>
                                    </div>
                                </div>
                            </div>
                            <TablerMarkdown
                                class='card-body'
                                :markdown='layer.description'
                            />
                            <div class='card-footer'>
                                Last updated <span v-text='timeDiff(layer.updated)' />
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
                                    inline='true'
                                    desc='Layer is updating'
                                />
                                <div class='ms-auto btn-list'>
                                    <IconX
                                        v-tooltip='"Cancel Stack Update"'
                                        class='cursor-pointer'
                                        :size='32'
                                        :stroke='1'
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
                                                @click='router.push(`/connection/${route.params.connectionid}/layer/${route.params.layerid}/deployment`)'
                                            ><IconPlaneDeparture
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Deployment</span></span>

                                            <div
                                                class='px-2 py-2 round btn-group w-100'
                                                role='group'
                                            >
                                                <input
                                                    id='layer-incoming'
                                                    type='radio'
                                                    class='btn-check'
                                                    autocomplete='off'
                                                    :checked='mode === "incoming"'
                                                    @click='mode = "incoming"'
                                                >
                                                <label
                                                    for='layer-incoming'
                                                    type='button'
                                                    class='btn btn-sm'
                                                ><IconWorldDownload
                                                    v-tooltip='"Incoming"'
                                                    :size='32'
                                                    stroke='1'
                                                />Incoming</label>

                                                <input
                                                    id='layer-outgoing'
                                                    type='radio'
                                                    class='btn-check'
                                                    autocomplete='off'
                                                    :checked='mode === "outgoing"'
                                                    @click='mode = "outgoing"'
                                                >
                                                <label
                                                    for='layer-outgoing'
                                                    type='button'
                                                    class='btn btn-sm'
                                                ><IconWorldUpload
                                                    v-tooltip='"Outgoing"'
                                                    :size='32'
                                                    stroke='1'
                                                />Outgoing</label>
                                            </div>

                                            <template v-if='mode === "incoming"'>
                                                <TablerNone
                                                    v-if='!layer.incoming'
                                                    label='Incoming Config'
                                                    :create='false'
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
                                                        @click='router.push(`/connection/${route.params.connectionid}/layer/${route.params.layerid}/incoming/config`)'
                                                    ><IconAdjustments
                                                        :size='32'
                                                        :stroke='1'
                                                    /><span class='mx-3'>Config</span></span>

                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-incoming-environment",
                                                            "cursor-pointer": route.name !== "layer-incoming-environment"
                                                        }'
                                                        @click='router.push(`/connection/${route.params.connectionid}/layer/${route.params.layerid}/incoming/environment`)'
                                                    ><IconBeach
                                                        :size='32'
                                                        :stroke='1'
                                                    /><span class='mx-3'>Environment</span></span>
                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-incoming-schema",
                                                            "cursor-pointer": route.name !== "layer-incoming-schema"
                                                        }'
                                                        @click='router.push(`/connection/${route.params.connectionid}/layer/${route.params.layerid}/incoming/schema`)'
                                                    ><IconSchema
                                                        :size='32'
                                                        :stroke='1'
                                                    /><span class='mx-3'>Schema</span></span>
                                                    <span
                                                        tabindex='0'
                                                        role='menuitem'
                                                        class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                        :class='{
                                                            "active": route.name === "layer-incoming-styles",
                                                            "cursor-pointer": route.name !== "layer-incoming-styles"
                                                        }'
                                                        @click='router.push(`/connection/${route.params.connectionid}/layer/${route.params.layerid}/incoming/styles`)'
                                                    ><IconPaint
                                                        :size='32'
                                                        :stroke='1'
                                                    /><span class='mx-3'>Styling</span></span>
                                                </template>
                                            </template>
                                            <template v-else>
                                                <TablerNone
                                                    label='Outgoing Config'
                                                    :create='false'
                                                />
                                            </template>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9'>
                                    <router-view
                                        :layer='layer'
                                        :stack='stack'
                                        @layer='layer = $event'
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

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import LayerStatus from './Layer/utils/Status.vue';
import cronstrue from 'cronstrue';
import timeDiff from '../timediff.ts';
import {
    TablerNone,
    TablerBreadCrumb,
    TablerIconButton,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    IconX,
    IconWorldDownload,
    IconWorldUpload,
    IconPencil,
    IconAlertTriangle,
    IconPlaneDeparture,
    IconAdjustments,
    IconBeach,
    IconSchema,
    IconPaint,
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();

const mode = ref('incoming');
const loading = ref({
    layer: true,
    stack: true
});
const stack = ref({})
const layer = ref({})
const capabilities = ref({});
const alerts = ref({})
const looping = ref(false);

watch(stack.value, async () => {
    if (stack.value.status.includes("_COMPLETE")) {
        loading.value.layer = true;
        await fetch()
        loading.value.layer = false;
    }
});

onMounted(async () => {
    await fetch();

    await fetchCapabilities();

    await fetchStatus();
    looping.value = setInterval(() => {
        fetchStatus();
    }, 10 * 1000);

    await fetchAlerts();

    loading.value.layer = false;
});

onUnmounted(() => {
    if (looping.value) {
        clearInterval(looping.value);
    }
});

function cronstr(cron) {
    if (!cron) return;

    if (cron.includes('cron(')) {
        return cronstrue.toString(cron.replace('cron(', '').replace(')', ''));
    } else {
        const rate = cron.replace('rate(', '').replace(')', '');
        return `Once every ${rate}`;
    }
}

async function fetch() {
    const url = stdurl(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}`);
    url.searchParams.append('alarms', 'true');
    layer.value = await std(url);
}

async function cancelUpdate() {
    await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/task`, {
        method: 'DELETE'
    });
}

async function fetchStatus(load = false) {
    loading.value.stack = load;
    stack.value = await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/task`);
    loading.value.stack = false;
}

async function fetchCapabilities() {
    capabilities.value = await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/task/capabilities`);
}

async function fetchAlerts() {
    alerts.value = await std(`/api/connection/${route.params.connectionid}/layer/${route.params.layerid}/alert`);
}
</script>
