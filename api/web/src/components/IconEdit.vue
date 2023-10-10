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

    <TablerLoading v-if='loading.iconset' desc='Loading Iconset'/>
    <div v-else class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class='card-header'>
                            <h3 class='card-title'>Iconset <span v-text='iconset.uid'/></h3>
                        </div>
                        <div class="card-body">
                            <TablerLoading v-if='loading.iconset' desc='Loading Iconset'/>
                            <TablerSchema v-else :schema='schema' v-model='iconset'/>

                            <div class='d-flex'>
                                <div class='ms-auto'>
                                    <div class='btn btn-primary'>Submit</div>
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
import {
    TablerBreadCrumb,
    TablerLoading,
    TablerDelete,
    TablerSchema
} from '@tak-ps/vue-tabler';
import {
    SettingsIcon,
} from 'vue-tabler-icons';

export default {
    name: 'IconEdit',
    data: function() {
        return {
            loading: {
                iconset: true
            },
            schema: {},
            iconset: {

            }
        }
    },
    mounted: async function() {
        await this.fetchSchema();

        if (this.$route.params.icon) {
            await this.fetch();
        } else {
            this.loading.iconset = false;
        }
    },
    methods: {
        fetch: async function() {
            this.loading.layer = true;
            this.layer = await window.std(`/api/iconset/${this.$route.params.icon}`);
            this.loading.layer = false;
        },
        fetchSchema: async function() {
            const url = await window.stdurl(`/api/schema`);
            url.searchParams.append('method', this.$route.params.icon ? 'PATCH' : 'POST');
            url.searchParams.append('url', this.$route.params.icon ? '/iconset/:iconset' : '/iconset');
            this.schema = (await window.std(url)).body;
        },
        deleteIconset: async function() {
            await window.std(`/api/iconset/${this.$route.params.icon}`, {
                method: 'DELETE'
            });

            this.$router.push('/iconset');
        },
    },
    components: {
        PageFooter,
        TablerBreadCrumb,
        TablerDelete,
        TablerLoading,
        TablerSchema,
        SettingsIcon,
    }
}
</script>
