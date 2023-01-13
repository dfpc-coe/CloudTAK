<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/")' class='cursor-pointer'>Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/layer")' class='cursor-pointer'>Layers</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#" v-text='layer.id'></a></li>
                        </ol>
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
                            <template v-if='layer.mode === "live"'>
                                <span class="status-indicator status-green status-indicator-animated">
                                      <span class="status-indicator-circle"></span>
                                      <span class="status-indicator-circle"></span>
                                      <span class="status-indicator-circle"></span>
                                </span>
                            </template>
                            <template v-else>
                                <span class="status-indicator status-blue status-indicator-animated">
                                      <span class="status-indicator-circle"></span>
                                      <span class="status-indicator-circle"></span>
                                      <span class="status-indicator-circle"></span>
                                </span>
                            </template>

                            <a @click='$router.push(`/layer/${layer.id}`)' class="card-title cursor-pointer" v-text='layer.name'></a>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <span v-if='layerdata.cron' v-text='cronstr(layer.cron)'/>

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

                <div v-if='layer.mode === "live"' class="col-lg-12">
                    <LayerTask/>
                </div>

                <div class="col-lg-12">
                    <LayerData v-model='layerdata' :disabled='true'/>
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
import cronstrue from 'cronstrue';
import LayerData from './Layer/LayerData.vue';
import LayerTask from './Layer/LayerTask.vue';
import Styles from './Layer/Styles.vue';
import timeDiff from '../timediff.js';
import {
    TablerLoading
} from '@tak-ps/vue-tabler'
import {
    SettingsIcon,
} from 'vue-tabler-icons'

export default {
    name: 'Layer',
    data: function() {
        return {
            err: false,
            loading: {
                layer: true
            },
            layerdata: {},
            layer: {}
        }
    },
    mounted: async function() {
        await this.fetch();
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

            const layer = await window.std(`/api/layer/${this.$route.params.layerid}`);
            this.layerdata = {
                mode: layer.mode,
                ...layer.data
            };
            delete layer.data;
            this.layer = layer;

            this.loading.layer = false;
        }
    },
    components: {
        SettingsIcon,
        LayerData,
        PageFooter,
        TablerLoading,
        LayerTask,
        Styles
    }
}
</script>
