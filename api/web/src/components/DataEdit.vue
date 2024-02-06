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
                                <div class='col-md-12'>
                                    <div class='col-12 d-flex'>
                                        <label>Data Groups</label>
                                        <div class='ms-auto'>
                                            <IconSettings @click='modal = true' class='cursor-pointer'/>
                                        </div>
                                    </div>

                                    <GroupSelectModal v-if='modal' @close='modal = false' v-model='data.mission_groups'/>

                                    <template v-if='data.mission_groups.length === 0'>
                                        <div class='col-12'>
                                            <span>All Groups</span>
                                        </div>

                                    </template>
                                    <template v-else>
                                        <div :key='group.name' v-for='group in data.mission_groups' class='col-12'>
                                            <span v-text='group' class='mx-2'/>
                                        </div>
                                    </template>
                                </div>
                                <div class="col-md-12">
                                    <TablerToggle
                                        label='Misison Sync'
                                        description='If Enabled, Assets will be uploaded to the Mission'
                                        v-model='data.mission_sync'
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
                                        <TablerDelete @delete='deleteData' label='Delete Data'/>
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
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
} from '@tabler/icons-vue'
import GroupSelectModal from './util/GroupSelectModal.vue';

export default {
    name: 'DataEdit',
    data: function() {
        return {
            modal: false,
            loading: {
                data: true,
            },
            errors: {
                name: '',
                description: '',
            },
            data: {
                name: '',
                auto_transform: true,
                mission_sync: true,
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
            this.data = await window.std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}`);
            this.loading.data = false;
        },
        deleteData: async function() {
            await window.std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}`, {
                method: 'DELETE'
            });

            this.$router.push(`/connection/${this.$route.params.connectionid}/data`);
        },
        create: async function() {
            for (const field of ['name', 'description']) {
                this.errors[field] = !this.data[field] ? 'Cannot be empty' : '';
            }
            for (const e in this.errors) if (this.errors[e]) return;

            this.loading.data = true;

            try {
                let url, method;
                const body = JSON.parse(JSON.stringify(this.data));

                if (this.$route.params.dataid) {
                    url = window.stdurl(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}`);
                    method = 'PATCH'
                } else {
                    url = window.stdurl(`/api/connection/${this.$route.params.connectionid}/data`);
                    method = 'POST'
                    body.connection = parseInt(this.$route.params.connectionid);
                }

                const create = await window.std(url, { method, body });

                this.loading.data = false;

                this.$router.push(`/connection/${this.$route.params.connectionid}/data/${create.id}`);
            } catch (err) {
                this.loading.data = false;
                throw err;
            }
        }
    },
    components: {
        IconSettings,
        PageFooter,
        GroupSelectModal,
        TablerBreadCrumb,
        TablerToggle,
        TablerDelete,
        TablerInput,
        TablerLoading
    }
}
</script>
