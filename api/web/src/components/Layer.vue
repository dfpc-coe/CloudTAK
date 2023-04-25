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

                            <a @click='$router.push(`/layer/${layer.id}`)' class="card-title cursor-pointer" v-text='layer.name'></a>

                            <div class='ms-auto'>
                                <div class='btn-list'>

                                    <AlertTriangleIcon 
                                        class='cursor-pointer'
                                        :class='{
                                            "text-red": alerts.total
                                        }'
                                        @click='$router.push(`/layer/${layer.id}/alert`)'
                                    />
                                    <DatabaseIcon class='cursor-pointer' @click='$router.push(`/layer/${layer.id}/query`)'/>
                                    <SettingsIcon class='cursor-pointer' @click='$router.push(`/layer/${layer.id}/edit`)'/>
                                </div>
                            </div>
                        </div>
                        <div class="card-body" v-text='layer.description'>
                        </div>
                        <div class="card-footer">
                            Last updated <span v-text='timeDiff(layer.updated)'/>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                    <LayerTask/>
                </div>

                <div class="col-lg-12">
                    <LayerData v-model='layer' :disabled='true'/>
                </div>

                <div class="col-lg-12">
                    <Styles v-model='layer.styles' :enabled='layer.enabled_styles' :disabled='true' />
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import LayerStatus from './Layer/Status.vue';
import cronstrue from 'cronstrue';
import LayerData from './Layer/LayerData.vue';
import LayerTask from './Layer/LayerTask.vue';
import Styles from './Layer/Styles.vue';
import timeDiff from '../timediff.js';
import {
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    SettingsIcon,
    DatabaseIcon,
    AlertTriangleIcon,
} from 'vue-tabler-icons'

export default {
    name: 'Layer',
    data: function() {
        return {
            err: false,
            loading: {
                layer: true
            },
            layer: {},
            alerts: {}
        }
    },
    mounted: async function() {
        await this.fetch();
        await this.fetchAlerts();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
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
            this.loading.layer = true;
            this.layer = await window.std(`/api/layer/${this.$route.params.layerid}`);
            this.loading.layer = false;
        },
        fetchAlerts: async function() {
            this.alerts = await window.std(`/api/layer/${this.$route.params.layerid}/alert`);
        }
    },
    components: {
        LayerStatus,
        SettingsIcon,
        LayerData,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading,
        DatabaseIcon,
        AlertTriangleIcon,
        LayerTask,
        Styles
    }
}
</script>
