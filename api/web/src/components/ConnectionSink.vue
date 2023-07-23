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

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <TablerLoading v-if='loading'/>
                    <div v-else class="card">
                        <div class="card-header">
                            <h1 class='card-title' v-text='sink.name'/>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <div class='d-flex'>
                                        <span class='px-2'>Logging</span>
                                        <label class="form-check form-switch">
                                            <input disabled v-model='sink.logging' class="form-check-input" type="checkbox">
                                        </label>
                                    </div>
                                    <div class='d-flex'>
                                        <span class='px-2'>Enabled</span>
                                        <label class="form-check form-switch">
                                            <input disabled v-model='sink.enabled' class="form-check-input" type="checkbox">
                                        </label>
                                    </div>
                                    <RefreshIcon class='cursor-pointer' @click='fetch'/>
                                    <SettingsIcon class='cursor-pointer' @click='$router.push(`/connection/${$route.params.connectionid}/sink/${$route.params.sinkid}/edit`)'/>
                                </div>
                            </div>
                        </div>
                        <div class='card-body'>
                            <EsriPortal
                                :disabled='true'
                                :pane='false'
                                :url='sink.body.url'
                                :sinkid='parseInt($route.params.sinkid)'
                                :layer='sink.body.layer'
                            />
                        </div>
                        <div class="card-footer">
                            Last updated <span v-text='timeDiff(sink.updated)'/>
                        </div>
                    </div>
                </div>
                <div class="col-lg-12">
                    <div class="card">
                        <div class="card-header">
                            <h1 class='card-title'>Sink Logging</h1>
                        </div>
                        <div class='card-body'>
                            <ConnectionSinkChart v-if='sink.logging'/>
                            <Alert v-else title='Logging Disabled' err='Turn on Sink Logging to get CoT Delivery Logs'/>
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
import PageFooter from './PageFooter.vue';
import timeDiff from '../timediff.js';
import {
    RefreshIcon,
    SettingsIcon
} from 'vue-tabler-icons'
import EsriPortal from './util/EsriPortal.vue';
import ConnectionSinkChart from './ConnectionSink/Chart.vue';
import {
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Alert from './util/Alert.vue';

export default {
    name: 'ConnectionSink',
    data: function() {
        return {
            loading: true,
            sink: {}
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        fetch: async function() {
            this.loading = true;
            this.sink = await window.std(`/api/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}`);
            this.loading = false;
        },
    },
    components: {
        RefreshIcon,
        SettingsIcon,
        PageFooter,
        Alert,
        EsriPortal,
        ConnectionSinkChart,
        TablerBreadCrumb,
        TablerLoading,
    }
}
</script>
