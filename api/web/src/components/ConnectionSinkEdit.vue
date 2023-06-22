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
                                        v-model='sink.name'
                                        :error='errors.name'
                                    />
                                </div>
                                <div class="col-12 col-md-4 mt-3">
                                    <TablerEnum
                                        label='Sink Type'
                                        :options='["ArcGIS"]'
                                        default='ArcGIS'
                                        v-model='sink.type'
                                        :error='errors.name'
                                    />
                                </div>

                                <template v-if='sink.type === "ArcGIS"'>
                                    <div class="col-12 mt-3">
                                        <TablerInput
                                            label='ArcGIS FeatureServer URL'
                                            v-model='sink.body.url'
                                        />
                                    </div>
                                    <div class="col-12 col-md-6 mt-3">
                                        <TablerInput
                                            label='ArcGIS Username'
                                            v-model='sink.body.username'
                                        />
                                    </div>
                                    <div class="col-12 col-md-6 mt-3">
                                        <TablerInput
                                            label='ArcGIS Password'
                                            v-model='sink.body.password'
                                        />
                                    </div>
                                </template>

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
import PageFooter from './PageFooter.vue';
import {
    PlusIcon,
} from 'vue-tabler-icons';
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
            sink: {
                name: '',
                type: 'ArcGIS',
                body: {},
                enabled: true,
            }
        }
    },
    mounted: async function() {
        if (!isNaN(parseInt(this.$route.params.sinkid))) await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.sink = await window.std(`/api/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}`);
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
                const create = await window.std(`/api/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}`, {
                    method: 'PATCH',
                    body: this.sink
                });
                this.$router.push(`/connection/${this.$route.params.sinkid}/sink/${create.id}`);
            } else {
                const create = await window.std(`/api/connection/${this.$route.params.connectionid}/sink`, {
                    method: 'POST',
                    body: this.sink
                });
                this.$router.push(`/connection/${create.connection}`);
            }
        },
        del: async function() {
            await window.std(`/api/connection/${this.$route.params.connectionid}/sink/${this.$route.params.sinkid}`, {
                method: 'DELETE'
            });
            this.$router.push(`/connection/${this.$route.params.connectionid}`);
        }
    },
    components: {
        PlusIcon,
        TablerDelete,
        TablerBreadCrumb,
        TablerEnum,
        TablerInput,
        PageFooter,
    }
}
</script>
