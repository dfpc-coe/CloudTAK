<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <TablerLoading
            v-if='loading.layer'
            class='text-white'
            desc='Loading Layer'
        />
        <div
            v-else
            class='page-body'
        >
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='card-header'>
                                <h3 class='card-title'>
                                    Layer <span v-text='layer.id' />
                                </h3>

                                <div class='ms-auto'>
                                    <div class='d-flex'>
                                        <div class='btn-list'>
                                            <div class='d-flex'>
                                                <span class='px-2'>Logging</span>
                                                <label class='form-check form-switch'>
                                                    <input
                                                        v-model='layer.logging'
                                                        class='form-check-input'
                                                        type='checkbox'
                                                    >
                                                </label>
                                            </div>
                                            <div class='d-flex'>
                                                <span class='px-2'>Enabled</span>
                                                <label class='form-check form-switch'>
                                                    <input
                                                        v-model='layer.enabled'
                                                        class='form-check-input'
                                                        type='checkbox'
                                                    >
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class='card-body'>
                                <div class='row row-cards'>
                                    <div class='col-md-12'>
                                        <TablerInput
                                            v-model='layer.name'
                                            label='Layer Name'
                                            :error='errors.name'
                                        />
                                    </div>
                                    <div class='col-md-12'>
                                        <TablerInput
                                            v-model='layer.description'
                                            label='Layer Description'
                                            :rows='6'
                                            :error='errors.description'
                                        />
                                    </div>
                                    <template v-if='!$route.params.layerid'>
                                        <div class='col-12'>
                                            <div
                                                class='btn-group w-100'
                                                role='group'
                                            >
                                                <input
                                                    id='template'
                                                    type='radio'
                                                    class='btn-check'
                                                    name='creation-type'
                                                    autocomplete='off'
                                                    :checked='type === "template"'
                                                    @click='type = "template"'
                                                >
                                                <label
                                                    for='template'
                                                    type='button'
                                                    class='btn'
                                                ><IconTemplate
                                                    class='me-2'
                                                    :size='20'
                                                    :stoke='1'
                                                /> Templated Creation</label>

                                                <input
                                                    id='manual'
                                                    type='radio'
                                                    class='btn-check'
                                                    name='creation-type'
                                                    autocomplete='off'
                                                    :checked='type === "manual"'
                                                    @click='type = "manual"'
                                                >
                                                <label
                                                    for='manual'
                                                    type='button'
                                                    class='btn'
                                                ><IconPencil
                                                    class='me-2'
                                                    :size='20'
                                                    :stoke='1'
                                                /> Manual Creation</label>
                                            </div>
                                        </div>

                                        <template v-if='type === "template"'>
                                            <LayerTemplateSelect v-model='template' />
                                        </template>
                                        <template v-else-if='type === "manual"'>
                                            <div class='card mx-2'>
                                                <div class='card-body row'>
                                                    <div class='col-md-12'>
                                                        <div class='d-flex' />
                                                        <TablerInput
                                                            v-model='layer.task'
                                                            :error='errors.task'
                                                            label='Schedule Task'
                                                            placeholder='Schedule Task'
                                                        >
                                                            <div class='ms-auto btn-list'>
                                                                <IconSettings
                                                                    :size='16'
                                                                    :stroke='1'
                                                                    class='cursor-pointer'
                                                                    @click='taskmodal = true'
                                                                />
                                                            </div>
                                                        </TablerInput>
                                                    </div>
                                                </div>
                                            </div>
                                        </template>
                                    </template>
                                    <div class='col-lg-12 d-flex'>
                                        <div v-if='$route.params.layerid'>
                                            <TablerDelete
                                                label='Delete Layer'
                                                @delete='deleteLayer'
                                            />
                                        </div>
                                        <div class='ms-auto'>
                                            <a
                                                v-if='$route.params.layerid'
                                                class='cursor-pointer btn btn-primary'
                                                @click='create'
                                            >Update Layer</a>
                                            <a
                                                v-else
                                                class='cursor-pointer btn btn-primary'
                                                @click='create'
                                            >Create Layer</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <PageFooter />

        <TaskModal
            v-if='taskmodal'
            :task='layer.task'
            @close='taskmodal = false'
            @task='taskmodal = false; layer.task = $event'
        />
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import LayerTemplateSelect from './util/LayerTemplateSelect.vue';
import {
    TablerBreadCrumb,
    TablerDelete,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
    IconTemplate,
    IconPencil,
} from '@tabler/icons-vue';
import TaskModal from './Layer/utils/TaskModal.vue';

export default {
    name: 'LayerEdit',
    components: {
        PageFooter,
        LayerTemplateSelect,
        TablerBreadCrumb,
        TablerInput,
        TablerDelete,
        TablerLoading,
        IconTemplate,
        IconPencil,
        IconSettings,
        TaskModal,
    },
    data: function() {
        return {
            type: 'template',
            loading: {
                layer: true
            },
            errors: {
                name: '',
                task: '',
                description: '',
            },
            taskmodal: false,
            template: null,
            layer: {
                name: '',
                description: '',
                task: '',
                enabled: true,
                logging: false,
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
        fetch: async function() {
            this.loading.layer = true;
            this.layer = await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}`);
            this.loading.layer = false;
        },
        deleteLayer: async function() {
            await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}`, {
                method: 'DELETE'
            });

            this.$router.push(`/connection/${this.$route.params.connectionid}/layer`);
        },
        create: async function() {
            let fields =  ['name', 'description']

            if (this.type === "manual") fields.push('task', 'cron');

            for (const field of fields) {
                this.errors[field] = !this.layer[field] ? 'Cannot be empty' : '';
            }
            for (const e in this.errors) if (this.errors[e]) return;

            this.loading.layer = true;

            let layer;

            try {
                let url;
                if (this.$route.params.layerid) {
                    url = stdurl(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}`);
                    layer = await std(url, {
                        method: 'PATCH',
                        body: {
                            name: this.layer.name,
                            description: this.layer.description,
                            enabled: this.layer.enabled,
                            logging: this.layer.logging,
                        }
                    });
                } else {
                    url = stdurl(`/api/connection/${this.$route.params.connectionid}/layer`);

                    layer = JSON.parse(JSON.stringify(this.layer));

                    let body = JSON.parse(JSON.stringify(this.layer));
                    if (this.type === "template" && this.template) {
                        // These should be overwritten
                        delete body.cron;
                        delete body.task;
                        body = { ...this.template, ...body };
                    }

                    layer = await std(url, { method: 'POST', body });
                }


                this.loading.layer = false;

                this.$router.push(`/connection/${this.$route.params.connectionid}/layer/${layer.id}`);
            } catch (err) {
                this.loading.layer = false;
                throw err;
            }
        }
    }
}
</script>
