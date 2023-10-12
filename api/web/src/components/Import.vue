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
                    <div class="card">
                        <div class='card-header'>
                            <h3 class='card-title'>Import <span v-text='imported.id'/></h3>
                        </div>
                        <TablerLoading v-if='loading'/>
                    </div>
                </div>

                <div class="col-lg-12">
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
    TablerNone,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'Import',
    data: function() {
        return {
            loading: true,
            imported: {
                id: ''
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/import/${this.$route.params.import}`);
            this.imported = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading
    }
}
</script>
