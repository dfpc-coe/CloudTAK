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
                    <DataTransforms/>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import DataTransforms from './Data/Transforms.vue';
import {
    TablerBreadCrumb
} from '@tak-ps/vue-tabler'

export default {
    name: 'DataJobs',
    data: function() {
        return {
            err: false,
            loading: {
                data: true
            },
            data: {}
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading.data = true;
            this.data = await window.std(`/api/data/${this.$route.params.dataid}`);
            this.loading.data = false;
        }
    },
    components: {
        PageFooter,
        DataTransforms,
        TablerBreadCrumb
    }
}
</script>
