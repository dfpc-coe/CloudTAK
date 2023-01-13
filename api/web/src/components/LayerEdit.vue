<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item"><a @click='$router.push("/")' class="cursor-pointer">Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a  @click='$router.push("/layer")' class="cursor-pointer">Layer</a></li>

                            <template v-if='$route.params.layerid'>
                                <li class="breadcrumb-item" aria-current="page"><a  @click='$router.push(`/layer/${$route.params.layerid}`)' class="cursor-pointer" v-text='$route.params.layerid'></a></li>
                                <li class="breadcrumb-item active" aria-current="page"><a href="#">Edit</a></li>
                            </template>
                            <template v-else>
                                <li class="breadcrumb-item active" aria-current="page"><a href="#">New</a></li>
                            </template>
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
                        <div class='card-header'>
                            <h3 class='card-title'>Layer <span v-text='layer.id'/></h3>

                            <div class='ms-auto'>
                                <div class='d-flex'>
                                    <span class='px-2'>Enabled</span>
                                    <label class="form-check form-switch">
                                        <input v-model='layer.enabled' class="form-check-input" type="checkbox">
                                    </label>
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
                    <LayerData :errors='errors' v-model='layerdata'/>
                </div>

                <div class="col-lg-12">
                    <StyleUtil v-model='layer.styles' :enabled='layer.enabled_styles' @enabled='layer.enabled_styles = $event'/>
                </div>

                <div class="col-lg-12">
                    <div class='card'>
                        <div class="card-body">
                            <div class='d-flex'>
                                <a v-if='$route.params.layerid' @click='deleteLayer' class="cursor-pointer btn btn-outline-danger">
                                    Delete Layer
                                </a>
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
import { TablerInput, TablerLoading } from '@tak-ps/vue-tabler';

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
            layerdata: {},
            layer: {
                name: '',
                description: '',
                enabled: true,
                enabled_styles: false,
                styles: {}
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

            const layer = await window.std(`/api/layer/${this.$route.params.layerid}`);
            this.layerdata = {
                mode: layer.mode,
                ...layer.data
            };
            delete layer.data;
            this.layer = layer;

            this.loading.layer = false;
        },
        deleteLayer: async function() {
            await window.std(`/api/layer/${this.$route.params.layerid}`, {
                method: 'DELETE'
            });

            this.$router.push('/layer');
        },
        create: async function() {
            for (const field of ['name', 'description']) {
                this.errors[field] = !this.layer[field] ? 'Cannot be empty' : '';
            }

            if (this.layerdata.mode === 'live') {
                for (const field of ['cron', 'task']) {
                    this.errors[field] = !this.layerdata[field] ? 'Cannot be empty' : '';
                }
            }

            for (const e in this.errors) if (this.errors[e]) return;

            let url, method;
            if (this.$route.params.layerid) {
                url = window.stdurl(`/api/layer/${this.$route.params.layerid}`);
                method = 'PATCH'
            } else {
                url = window.stdurl(`/api/layer`);
                method = 'POST'
            }

            const body = JSON.parse(JSON.stringify(this.layer));
            body.data = JSON.parse(JSON.stringify(this.layerdata));

            body.mode = body.data.mode;
            delete body.data.mode;

            const create = await window.std(url, { method, body });

            this.$router.push(`/layer/${create.id}`);
        }
    },
    components: {
        PageFooter,
        TablerInput,
        StyleUtil,
        LayerData,
        TablerLoading
    }
}
</script>
