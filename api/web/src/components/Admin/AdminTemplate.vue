<template>
    <div>
        <div class='card-header'>
            <IconCircleArrowLeft
                :size='32'
                stroke='1'
                class='cursor-pointer'
                @click='$router.push("/admin/template")'
            />
            <h1 class='mx-2 card-title d-flex align-items-center'>
                <div class='mx-2'>
                    Template
                    <span
                        class='mx-2'
                        v-text='template.name'
                    />
                </div>
            </h1>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='!loading && $route.params.template !== "new"'
                    v-tooltip='"Delete Template"'
                    displaytype='icon'
                    @delete='fetchDelete'
                />
                <IconRefresh
                    v-if='!loading && $route.params.template !== "new"'
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='fetch'
                />
            </div>
        </div>
        <div>
            <TablerLoading v-if='loading' />
            <div
                v-else
                class='card-body'
            >
                <div class='row row-cards'>
                    <div class='col-md-12'>
                        <TablerInput
                            v-model='template.name'
                            label='Layer Name'
                            :error='errors.name'
                        />
                    </div>
                    <div class='col-md-12'>
                        <TablerInput
                            v-model='template.description'
                            label='Layer Description'
                            :rows='3'
                            :error='errors.description'
                        />
                    </div>
                    <div class='col-md-12'>
                        <TablerToggle
                            v-model='template.datasync'
                            label='Data Sync Required'
                        />
                    </div>

                    <template v-if='$route.params.template === "new"'>
                        <LayerSelect v-model='template.layer' />

                        <div class='col-md-12 d-flex align-items-center'>
                            <div class='ms-auto'>
                                <button
                                    :disabled='!template.layer'
                                    class='btn btn-primary'
                                    @click='createTemplate'
                                >
                                    Submit
                                </button>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <div class='col-md-12 d-flex align-items-center'>
                            <div class='ms-auto'>
                                <button
                                    class='btn btn-primary'
                                    @click='updateTemplate'
                                >
                                    Update
                                </button>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import LayerSelect from '../util/LayerSelect.vue';
import {
    TablerToggle,
    TablerInput,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

export default {
    name: 'AdminTemplateAdmin',
    components: {
        TablerInput,
        TablerToggle,
        TablerDelete,
        IconRefresh,
        IconCircleArrowLeft,
        LayerSelect,
        TablerLoading,
    },
    data: function() {
        return {
            err: false,
            loading: true,
            errors: {
                name: '',
                description: ''
            },
            template: {
                name: '',
                description: '',
                datasync: true
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.template !== 'new') {
            await this.fetch();
        } else {
            this.loading = false;
        }
    },
    methods: {
        fetchDelete: async function() {
            this.loading = true;
            const url = stdurl(`/api/template/${this.$route.params.template}`);
            await std(url, {
                method: 'DELETE'
            });

            this.$router.push("/admin/template");
        },
        isValid: function() {
            let fields =  ['name', 'description']
            for (const field of fields) {
                this.errors[field] = !this.template[field] ? 'Cannot be empty' : '';
            }

            if (this.template.name.length < 4) this.errors.name = 'Name too short'
            if (this.template.description.length < 8) this.errors.description = 'Description too short'
            for (const e in this.errors) if (this.errors[e]) return false;

            return true;
        },
        createTemplate: async function() {
            if (!this.isValid()) return;

            this.loading = true;
            const url = stdurl(`/api/template`);
            await std(url, {
                method: 'POST',
                body: this.template
            });

            this.$router.push('/admin/template');
        },
        deleteTemplate: async function() {
            this.loading = true;
            const url = stdurl(`/api/template/${this.template.id}`);
            await std(url, { method: 'DELETE', });

            this.$router.push('/admin/template');
        },
        updateTemplate: async function() {
            if (!this.isValid()) return;

            this.loading = true;
            const url = stdurl(`/api/template/${this.template.id}`);
            await std(url, {
                method: 'PATCH',
                body: this.template
            });

            this.$router.push('/admin/template');
        },
        fetch: async function() {
            this.loading = true;
            const url = stdurl(`/api/template/${this.$route.params.template}`);
            this.template = await std(url);
            this.loading = false;
        }
    }
}
</script>
