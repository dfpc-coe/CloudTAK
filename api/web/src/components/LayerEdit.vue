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
                        <div class='card-header'>
                            <h3 class='card-title'>Layer <span v-text='layer.id'/></h3>

                            <div class='ms-auto'>
                                <div class='d-flex'>
                                    <div class='btn-list'>
                                        <div class='d-flex'>
                                            <span class='px-2'>Logging</span>
                                            <label class="form-check form-switch">
                                                <input v-model='layer.logging' class="form-check-input" type="checkbox">
                                            </label>
                                        </div>
                                        <div class='d-flex'>
                                            <span class='px-2'>Enabled</span>
                                            <label class="form-check form-switch">
                                                <input v-model='layer.enabled' class="form-check-input" type="checkbox">
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class='row row-cards'>
                                <div class="col-md-12">
                                    <TablerInput
                                        label='Layer Name'
                                        v-model='layer.name'
                                        :error='errors.name'
                                    />
                                </div>
                                <div class="col-md-12">
                                    <TablerInput
                                        label='Layer Description'
                                        :rows='6'
                                        v-model='layer.description'
                                        :error='errors.description'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                    <LayerData :errors='errors' v-model='layer'/>
                </div>

                <div v-if='layer.id' class="col-lg-12">
                    <LayerSchema v-model='layer.schema' :disabled='false'/>
                </div>

                <div class="col-lg-12">
                    <StyleUtil v-model='layer.styles' :enabled='layer.enabled_styles' @enabled='layer.enabled_styles = $event'/>
                </div>

                <div class="col-lg-12">
                    <div class='card'>
                        <div class="card-body">
                            <div class='d-flex'>
                                <div v-if='$route.params.layerid'>
                                    <TablerDelete @delete='deleteLayer' label='Delete Layer'/>
                                </div>
                                <div class='ms-auto'>
                                    <a v-if='$route.params.layerid' @click='create' class="cursor-pointer btn btn-primary">Update Layer</a>
                                    <a v-else @click='create' class="cursor-pointer btn btn-primary">Create Layer</a>
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
import StyleUtil from './Layer/Styles.vue';
import LayerData from './Layer/LayerData.vue';
import LayerSchema from './Layer/LayerSchema.vue';
import {
    TablerBreadCrumb,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'LayerEdit',
    data: function() {
        return {
            loading: {
                layer: true
            },
            errors: {
                name: '',
                description: '',
                cron: '',
                task: ''
            },
            conn: {
                id: null,
                status: '',
                name: ''
            },
            layer: {
                name: '',
                description: '',
                enabled: true,
                logging: true,
                enabled_styles: false,
                styles: {},
                schema: {
                    type: 'object',
                    additionalProperties: false,
                    required: [],
                    properties: {}
                }
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.layerid) {
            await this.fetch();
        } else {
            this.loading.layer = false;
        }
    },
    methods: {
        fetch: async function() {
            this.loading.layer = true;
            this.layer = await window.std(`/api/layer/${this.$route.params.layerid}`);
            this.loading.layer = false;
        },
        deleteLayer: async function() {
            await window.std(`/api/layer/${this.$route.params.layerid}`, {
                method: 'DELETE'
            });

            this.$router.push('/layer');
        },
        create: async function() {
            for (const field of ['name', 'description', 'cron', 'task', 'timeout', 'memory']) {
                this.errors[field] = !this.layer[field] ? 'Cannot be empty' : '';
            }
            for (const e in this.errors) if (this.errors[e]) return;

            this.loading.layer = true;

            try {
                let url, method;
                if (this.$route.params.layerid) {
                    url = window.stdurl(`/api/layer/${this.$route.params.layerid}`);
                    method = 'PATCH'
                } else {
                    url = window.stdurl(`/api/layer`);
                    method = 'POST'
                }

                const create = await window.std(url, { method, body: this.layer });

                this.loading.layer = false;

                this.$router.push(`/layer/${create.id}`);
            } catch (err) {
                this.loading.layer = false;
                throw err;
            }
        }
    },
    components: {
        PageFooter,
        TablerBreadCrumb,
        TablerInput,
        TablerDelete,
        StyleUtil,
        LayerData,
        LayerSchema,
        TablerLoading
    }
}
</script>
