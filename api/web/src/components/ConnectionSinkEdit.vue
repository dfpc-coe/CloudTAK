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
                    <div class="card">
                        <div class='card-header'>
                            <h3 v-if='$route.params.sinkid' class='card-title'>Connection Sink <span v-text='sink.id'/></h3>
                            <h3 v-else class='card-title'>New Connection Sink</h3>

                            <div class='ms-auto'>
                                <div class='d-flex'>
                                    <div class='btn-list'>
                                        <div class='d-flex'>
                                            <span class='px-2'>Logging</span>
                                            <label class="form-check form-switch">
                                                <input v-model='sink.logging' class="form-check-input" type="checkbox">
                                            </label>
                                        </div>
                                        <div class='d-flex'>
                                            <span class='px-2'>Enabled</span>
                                            <label class="form-check form-switch">
                                                <input v-model='sink.enabled' class="form-check-input" type="checkbox">
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class='row row-cards'>
                                <div class="col-12 col-md-8 mt-3">
                                    <TablerInput
                                        label='Sink Name'
                                        :disabled='disabled'
                                        v-model='sink.name'
                                        :error='errors.name'
                                    />
                                </div>
                                <div class="col-12 col-md-4 mt-3">
                                    <TablerEnum
                                        label='Sink Type'
                                        :options='["ArcGIS"]'
                                        :disabled='disabled'
                                        default='ArcGIS'
                                        v-model='sink.type'
                                        :error='errors.name'
                                    />
                                </div>

                                <template v-if='!$route.params.sinkid && sink.type === "ArcGIS"'>
                                    <div class="col-12 mt-3">
                                        <TablerInput
                                            label='ArcGIS Portal URL (Example: https://example.com/portal/sharing/rest)'
                                            :disabled='disabled'
                                            v-model='sink.body.url'
                                        />
                                    </div>
                                    <div class="col-12 col-md-6 mt-3">
                                        <TablerInput
                                            label='ArcGIS Username'
                                            :disabled='disabled'
                                            v-model='sink.body.username'
                                        />
                                    </div>
                                    <div class="col-12 col-md-6 mt-3">
                                        <TablerInput
                                            type='password'
                                            label='ArcGIS Password'
                                            :disabled='disabled'
                                            v-model='sink.body.password'
                                        />
                                    </div>
                                    <div class="col-md-12 mt-3">
                                        <template v-if='!esriView.view'>
                                            <div class='d-flex'>
                                                <div class='ms-auto'>
                                                    <a @click='esriView.view = true' class="cursor-pointer btn btn-primary">Connect</a>
                                                </div>
                                            </div>
                                        </template>
                                        <template v-else>
                                            <EsriPortal
                                                :url='sink.body.url'
                                                :username='sink.body.username'
                                                :password='sink.body.password'
                                                @layer='sink.body.layer = $event'
                                                @close='esriView.view = false'
                                            />
                                        </template>
                                    </div>
                                    <div class="col-md-12 mt-3">
                                        <div class='d-flex'>
                                            <div class='ms-auto'>
                                                <button @click='create' v-if='sink.body.layer' class="cursor-pointer btn btn-primary">Save Sink</button>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                                <template v-else>
                                    <div class="col-md-12 mt-3">
                                        <div class='d-flex'>
                                            <template v-if='$route.params.sinkid'>
                                                <TablerDelete @delete='del' label='Delete Sink'/>
                                            </template>

                                            <div class='ms-auto'>
                                                <a @click='create' class="cursor-pointer btn btn-primary">Save Sink</a>
                                            </div>
                                        </div>
                                    </div>
                                </template>
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
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import EsriPortal from './util/EsriPortal.vue';
import {
    IconPlus,
} from '@tabler/icons-vue';
import {
    TablerBreadCrumb,
    TablerEnum,
    TablerDelete,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionSinkEdit',
    data: function() {
        return {
            errors: {
                name: '',
            },
            esriView: {
                view: false
            },
            disabled: false,
            save: false,
            sink: {
                name: '',
                type: 'ArcGIS',
                body: {
                    // TODO Dynamically change these via above type
                    url: '',
                    username: '',
                    password: '',
                    layer: ''
                },
                logging: false,
                enabled: true,
            }
        }
    },
    watch: {
        'esriView.view': function() {
            this.disabled = this.esriView.view;
        }
    },
    mounted: async function() {
        if (!isNaN(parseInt(this.$route.params.sinkid))) await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.sink = await std(`/api/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}`);
        },
        create: async function() {
            for (const field of ['name']) {
                if (!this.sink[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            if (this.$route.params.sinkid) {
                const create = await std(`/api/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}`, {
                    method: 'PATCH',
                    body: this.sink
                });
                this.$router.push(`/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}`);
            } else {
                const create = await std(`/api/connection/${this.$route.params.connectionid}/sink`, {
                    method: 'POST',
                    body: this.sink
                });
                this.$router.push(`/connection/${create.connection}`);
            }
        },
        del: async function() {
            await std(`/api/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}`, {
                method: 'DELETE'
            });
            this.$router.push(`/connection/${this.$route.params.connectionid}`);
        }
    },
    components: {
        IconPlus,
        TablerDelete,
        TablerBreadCrumb,
        TablerEnum,
        TablerInput,
        PageFooter,
        EsriPortal,
    }
}
</script>
