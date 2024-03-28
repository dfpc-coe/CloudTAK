<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <TablerBreadCrumb/>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <TablerLoading v-if='loading.layer' desc='Loading Layer'/>
    <div v-else class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class="card-header">
                            <LayerStatus :layer='layer'/>

                            <a @click='$router.push(`/layer/${layer.id}`)' class="card-title cursor-pointer mx-2" v-text='layer.name'></a>

                            <div class='ms-auto'>
                                <div class='btn-list'>

                                    <IconAlertTriangle
                                        size='32'
                                        class='cursor-pointer'
                                        :class='{ "text-red": alerts.total }'
                                        v-tooltip='"Layer Alerts"'
                                        @click='$router.push(`/layer/${layer.id}/alert`)'
                                    />
                                    <IconDatabase
                                        size='32'
                                        class='cursor-pointer'
                                        v-tooltip='"CoT Logging"'
                                        @click='$router.push(`/layer/${layer.id}/query`)'
                                    />
                                    <IconSettings
                                        size='32'
                                        class='cursor-pointer'
                                        v-tooltip='"Edit"'
                                        @click='$router.push(`/layer/${layer.id}/edit`)'
                                    />
                                </div>
                            </div>
                        </div>
                        <TablerMarkdown class='card-body' :markdown='layer.description'/>
                        <div class="card-footer">
                            Last updated <span v-text='timeDiff(layer.updated)'/>
                        </div>
                    </div>
                </div>

                <div class='col-lg-12'>
                    <div v-if='loading.layer' class='card'>
                        <div class='card-body'><TablerLoading desc='Loading Layer'/></div>
                    </div>
                    <div v-else-if='loading.stack' class='card'>
                        <div class='card-body'><TablerLoading desc='Loading Stack Status'/></div>
                    </div>
                    <div v-else-if='stack && !stack.status.includes("_COMPLETE")' class='card'>
                        <div class='card-header d-flex align-items-center'>
                            <TablerLoading inline='true' desc='Layer is updating'/>
                            <div class='ms-auto btn-list'>
                                <IconX @click='cancelUpdate' class='cursor-pointer' size='32' v-tooltip='"Cancel Stack Update"'/>
                            </div>
                        </div>
                        <div class='card-body'>
                            <pre v-text='stack.status'/>
                        </div>
                    </div>
                    <div v-else class='card'>
                        <div class='row g-0'>
                            <div class="col-12 col-md-3 border-end">
                                <div class="card-body">
                                    <h4 class="subheader">Layer Settings</h4>
                                    <div class="list-group list-group-transparent">
                                        <span @click='$router.push(`/layer/${$route.params.layerid}/deployment`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "layer-deployment",
                                            "cursor-pointer": $route.name !== "layer-deployment"
                                        }'><IconPlaneDeparture size='32'/><span class='mx-3'>Deployment</span></span>
                                        <span @click='$router.push(`/layer/${$route.params.layerid}/config`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "layer-config",
                                            "cursor-pointer": $route.name !== "layer-config"
                                        }'><IconAdjustments size='32'/><span class='mx-3'>Config</span></span>
                                        <span @click='$router.push(`/layer/${$route.params.layerid}/environment`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "layer-environment",
                                            "cursor-pointer": $route.name !== "layer-environment"
                                        }'><IconBeach size='32'/><span class='mx-3'>Environment</span></span>
                                        <span @click='$router.push(`/layer/${$route.params.layerid}/schema`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "layer-schema",
                                            "cursor-pointer": $route.name !== "layer-schema"
                                        }'><IconSchema size='32'/><span class='mx-3'>Schema</span></span>
                                        <span @click='$router.push(`/layer/${$route.params.layerid}/styles`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "layer-styles",
                                            "cursor-pointer": $route.name !== "layer-styles"
                                        }'><IconPaint size='32'/><span class='mx-3'>Styling</span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-md-9">
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

    <PageFooter/>
</div>
</template>

<script>
import { std } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import LayerStatus from './Layer/utils/Status.vue';
import cronstrue from 'cronstrue';
import timeDiff from '../timediff.js';
import {
    TablerBreadCrumb,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    IconX,
    IconSettings,
    IconDatabase,
    IconAlertTriangle,
    IconPlaneDeparture,
    IconAdjustments,
    IconBeach,
    IconSchema,
    IconPaint,
} from '@tabler/icons-vue'

export default {
    name: 'ConnectionLayer',
    data: function() {
        return {
            err: false,
            loading: {
                layer: true,
                stack: true
            },
            stack: {},
            layer: {},
            alerts: {},
            looping: false
        }
    },
    mounted: async function() {
        await this.fetch();

        await this.fetchStatus();
        this.looping = setInterval(() => {
            this.fetchStatus();
        }, 10 * 1000);

        await this.fetchAlerts();

        this.loading.layer = false;
    },
    unmounted: function() {
        this.clear()
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        clear: function() {
            if (this.looping) clearInterval(this.looping);
        },
        cronstr: function(cron) {
            if (!cron) return;

            if (cron.includes('cron(')) {
                return cronstrue.toString(cron.replace('cron(', '').replace(')', ''));
            } else {
                const rate = cron.replace('rate(', '').replace(')', '');
                return `Once every ${rate}`;
            }
        },
        fetch: async function() {
            this.layer = await std(`/api/layer/${this.$route.params.layerid}`);
        },
        cancelUpdate: async function() {
            await std(`/api/layer/${this.$route.params.layerid}/task`, {
                method: 'DELETE'
            });
        },
        fetchStatus: async function(loading = false) {
            this.loading.stack = loading;
            this.stack = await std(`/api/layer/${this.$route.params.layerid}/task`);
            this.loading.stack = false;
        },
        fetchAlerts: async function() {
            this.alerts = await std(`/api/layer/${this.$route.params.layerid}/alert`);
        }
    },
    components: {
        LayerStatus,
        PageFooter,
        TablerBreadCrumb,
        TablerMarkdown,
        TablerLoading,
        IconX,
        IconSettings,
        IconDatabase,
        IconAlertTriangle,
        IconPlaneDeparture,
        IconAdjustments,
        IconBeach,
        IconSchema,
        IconPaint,
    }
}
</script>
