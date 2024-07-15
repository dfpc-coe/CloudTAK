<template>
    <div>
        <div class='card-header'>
            <IconCircleArrowLeft
                :size='32'
                :stroke='1'
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
                    :stroke='1'
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

                    <LayerSelect/>
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
            errors: {},
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
        fetch: async function() {
            this.loading = true;
            const url = stdurl(`/api/template/${this.$route.params.template}`);
            this.video = await std(url);
            this.loading = false;
        }
    }
}
</script>
