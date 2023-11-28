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

    <TablerLoading v-if='loading.data' desc='Loading Data'/>
    <div v-else class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class='card-header'>
                            <h3 class='card-title'>Data <span v-text='data.id'/></h3>
                        </div>
                        <div class="card-body">
                            <div class='row row-cards'>
                                <div class="col-md-12">
                                    <TablerInput
                                        label='Data Name'
                                        description='The human readable name of the Data Layer'
                                        v-model='data.name'
                                        :error='errors.name'
                                    />
                                </div>
                                <div class="col-md-12">
                                    <TablerToggle
                                        label='Auto Transform'
                                        description='If Enabled, Assets uploaded to the Data package will be automatically transformed into Cloud & TAK Native formats'
                                        v-model='data.auto_transform'
                                    />
                                </div>
                                <div class="col-md-12">
                                    <TablerInput
                                        label='Data Description'
                                        description='The human readable description of the Data Layer'
                                        :rows='6'
                                        v-model='data.description'
                                        :error='errors.description'
                                    />
                                </div>
                                <div class='d-flex'>
                                    <div v-if='$route.params.dataid'>
                                        <TablerDelete @delete='deleteLayer' label='Delete Data'/>
                                    </div>
                                    <div class='ms-auto'>
                                        <a v-if='$route.params.dataid' @click='create' class="cursor-pointer btn btn-primary">Update Data</a>
                                        <a v-else @click='create' class="cursor-pointer btn btn-primary">Create Data</a>
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
    TablerBreadCrumb,
    TablerInput,
    TablerToggle,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataEdit',
    data: function() {
        return {
            loading: {
                data: true
            },
            errors: {
                name: '',
                description: '',
            },
            data: {
                name: '',
                auto_transform: true,
                description: '',
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.dataid) {
            await this.fetch();
        } else {
            this.loading.data = false;
        }
    },
    methods: {
        fetch: async function() {
            this.loading.data = true;
            this.data = await window.std(`/api/data/${this.$route.params.dataid}`);
            this.loading.data = false;
        },
        deleteLayer: async function() {
            await window.std(`/api/data/${this.$route.params.dataid}`, {
                method: 'DELETE'
            });

            this.$router.push('/data');
        },
        create: async function() {
            for (const field of ['name', 'description']) {
                this.errors[field] = !this.data[field] ? 'Cannot be empty' : '';
            }
            for (const e in this.errors) if (this.errors[e]) return;

            this.loading.data = true;

            try {
                let url, method;
                if (this.$route.params.dataid) {
                    url = window.stdurl(`/api/data/${this.$route.params.dataid}`);
                    method = 'PATCH'
                } else {
                    url = window.stdurl(`/api/data`);
                    method = 'POST'
                }

                const create = await window.std(url, { method, body: this.data });

                this.loading.data = false;

                this.$router.push(`/data/${create.id}`);
            } catch (err) {
                this.loading.data = false;
                throw err;
            }
        }
    },
    components: {
        PageFooter,
        TablerBreadCrumb,
        TablerToggle,
        TablerInput,
        TablerLoading
    }
}
</script>
