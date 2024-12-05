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
                                    @click='$router.push(`/connection/${$route.params.connectionid}/layer/${layer.id}`)'
                                    v-text='layer.name'
                                />

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <IconAlertTriangle
                                            v-tooltip='"Layer Alerts"'
                                            :size='32'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            :class='{ "text-red": alerts.total }'
                                            @click='$router.push(`/connection/${$route.params.connectionid}/layer/${layer.id}/alert`)'
                                        />
                                        <IconSettings
                                            v-tooltip='"Edit"'
                                            :size='32'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click='$router.push(`/connection/${$route.params.connectionid}/layer/${layer.id}/edit`)'
                                        />
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
                                        <div class='list-group list-group-transparent'>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "layer-deployment",
                                                    "cursor-pointer": $route.name !== "layer-deployment"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/layer/${$route.params.layerid}/deployment`)'
                                            ><IconPlaneDeparture
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Deployment</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "layer-config",
                                                    "cursor-pointer": $route.name !== "layer-config"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/layer/${$route.params.layerid}/config`)'
                                            ><IconAdjustments
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Config</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "layer-environment",
                                                    "cursor-pointer": $route.name !== "layer-environment"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/layer/${$route.params.layerid}/environment`)'
                                            ><IconBeach
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Environment</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "layer-schema",
                                                    "cursor-pointer": $route.name !== "layer-schema"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/layer/${$route.params.layerid}/schema`)'
                                            ><IconSchema
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Schema</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "layer-styles",
                                                    "cursor-pointer": $route.name !== "layer-styles"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/layer/${$route.params.layerid}/styles`)'
                                            ><IconPaint
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Styling</span></span>
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

<script>
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import LayerStatus from './Layer/utils/Status.vue';
import cronstrue from 'cronstrue';
import timeDiff from '../timediff.ts';
import {
    TablerBreadCrumb,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    IconX,
    IconSettings,
    IconAlertTriangle,
    IconPlaneDeparture,
    IconAdjustments,
    IconBeach,
    IconSchema,
    IconPaint,
} from '@tabler/icons-vue'

export default {
    name: 'ConnectionLayer',
    components: {
        LayerStatus,
        PageFooter,
        TablerBreadCrumb,
        TablerMarkdown,
        TablerLoading,
        IconX,
        IconSettings,
        IconAlertTriangle,
        IconPlaneDeparture,
        IconAdjustments,
        IconBeach,
        IconSchema,
        IconPaint,
    },
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
    watch: {
        'stack.status': async function() {
            if (this.stack.status.includes("_COMPLETE")) {
                this.loading.layer = true;
                await this.fetch()
                this.loading.layer = false;
            }
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
            const url = stdurl(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}`);
            url.searchParams.append('alarms', 'true');
            this.layer = await std(url);
        },
        cancelUpdate: async function() {
            await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/task`, {
                method: 'DELETE'
            });
        },
        fetchStatus: async function(loading = false) {
            this.loading.stack = loading;
            this.stack = await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/task`);
            this.loading.stack = false;
        },
        fetchAlerts: async function() {
            this.alerts = await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/alert`);
        }
    }
}
</script>
