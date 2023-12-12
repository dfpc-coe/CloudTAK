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
                                <template v-if='!$route.params.layerid'>
                                    <div class="col-md-6">
                                        <TablerInput v-model='layer.cron' :error='errors.cron' placeholder='Cron Expression'>
                                            <div class='dropdown'>
                                                <div class="dropdown-toggle" type="button" id="dropdownCron" data-bs-toggle="dropdown" aria-expanded="false">
                                                    <IconSettings width='16' height='16' class='cursor-pointer dropdown-toggle'/>
                                                </div>
                                                <ul class="dropdown-menu px-1 py-1" aria-labelledby="dropdownCron">
                                                    <li class='py-1 cursor-pointer' @click='layer.cron = "rate(1 minute)"'>rate(1 minute)</li>
                                                    <li class='py-1 cursor-pointer' @click='layer.cron = "rate(5 minutes)"'>rate(5 minutes)</li>
                                                    <li class='py-1 cursor-pointer' @click='layer.cron = "cron(15 10 * * ? *)"'>cron(15 10 * * ? *)</li>
                                                    <li class='py-1 cursor-pointer' @click='layer.cron = "cron(0/5 8-17 ? * MON-FRI *)"'>cron(0/5 8-17 ? * MON-FRI *)</li>
                                                </ul>
                                            </div>
                                        </TablerInput>
                                        <label v-if='layer.cron' v-text='cronstr(layer.cron)'/>
                                    </div>
                                    <div class="col-md-6">
                                        <div class='d-flex'>
                                        </div>
                                        <TablerInput v-model='layer.task' :error='errors.task' placeholder='Schedule Task'>
                                            <div class='ms-auto btn-list'>
                                                <IconSettings @click='taskmodal = true' width='16' height='16' class='cursor-pointer'/>
                                            </div>
                                        </TablerInput>
                                    </div>
                                    <div class="col-md-12">
                                        <div class='row'>
                                            <div class='col-12'>
                                                <label>Data Destination</label>
                                            </div>
                                            <div class='col-12 d-flex'>
                                                <div class='btn-group' role="group">
                                                    <input :disabled='disabled' v-model='destination' value='connection' type="radio" class="btn-check" name="connection-toolbar" id="connection-toolbar-connection" autocomplete="off">
                                                    <label for="connection-toolbar-connection" class="btn btn-icon"><IconBuildingBroadcastTower/></label>

                                                    <input :disabled='disabled' v-model='destination' value='data' type="radio" class="btn-check" name="connection-toolbar" id="connection-toolbar-data" autocomplete="off">
                                                    <label for="connection-toolbar-data" class="btn btn-icon"><IconDatabase/></label>
                                                </div>
                                                <ConnectionSelect
                                                    v-if='destination === "connection"'
                                                    class='mx-2'
                                                    :disabled='disabled'
                                                    v-model='layer.connection'
                                                />
                                                <DataSelect
                                                    v-else
                                                    class='mx-2'
                                                    :disabled='disabled'
                                                    v-model='layer.data'
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </template>
                                <div class="col-lg-12 d-flex">
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
    </div>

    <PageFooter/>

    <TaskModal v-if='taskmodal' :task='layer.task' @close='taskmodal = false' @task='taskmodal = false; layer.task = $event'/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import cronstrue from 'cronstrue';
import ConnectionSelect from './util/ConnectionSelect.vue';
import DataSelect from './util/DataSelect.vue';
import {
    TablerBreadCrumb,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
    IconBuildingBroadcastTower,
    IconDatabase,
} from '@tabler/icons-vue';
import TaskModal from './Layer/utils/TaskModal.vue';

export default {
    name: 'LayerEdit',
    data: function() {
        return {
            loading: {
                layer: true
            },
            errors: {
                name: '',
                cron: '',
                task: '',
                description: '',
            },
            taskmodal: false,
            destination: 'connection',
            layer: {
                name: '',
                description: '',
                data: null,
                connection: null,
                cron: '',
                task: '',
                enabled: true,
                logging: true,
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
        updateTask: function() {
            this.layer.task = this.layer.task.replace(/-v[0-9]+\.[0-9]+\.[0-9]+$/, `-v${this.newTaskVersion}`);
            this.newTaskVersion = null;
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
        deleteLayer: async function() {
            await window.std(`/api/layer/${this.$route.params.layerid}`, {
                method: 'DELETE'
            });

            this.$router.push('/layer');
        },
        create: async function() {
            let fields =  ['name', 'description']
            if (!this.$route.params.connectionid) fields.push('task', 'cron');

            for (const field of ['name', 'description']) {
                this.errors[field] = !this.layer[field] ? 'Cannot be empty' : '';
            }
            for (const e in this.errors) if (this.errors[e]) return;

            this.loading.layer = true;

            let layer;

            try {
                let url, method;
                if (this.$route.params.layerid) {
                    url = window.stdurl(`/api/layer/${this.$route.params.layerid}`);
                    layer = await window.std(url, {
                        method: 'PATCH',
                        body: {
                            name: this.layer.name,
                            description: this.layer.description,
                            enabled: this.layer.enabled,
                            logging: this.layer.logging,
                        }
                    });
                } else {
                    url = window.stdurl(`/api/layer`);

                    layer = JSON.parse(JSON.stringify(this.layer));

                    if (this.layer.connection) delete layer.data;
                    if (this.layer.data) delete layer.connection;

                    layer = await window.std(url, {
                        method: 'POST',
                        body: layer
                    });
                }


                this.loading.layer = false;

                this.$router.push(`/layer/${layer.id}`);
            } catch (err) {
                this.loading.layer = false;
                throw err;
            }
        }
    },
    components: {
        PageFooter,
        ConnectionSelect,
        DataSelect,
        TablerBreadCrumb,
        TablerInput,
        TablerDelete,
        TablerLoading,
        IconSettings,
        IconBuildingBroadcastTower,
        IconDatabase,
        TaskModal,
    }
}
</script>
