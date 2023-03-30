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
                        <div class="card-header">
                            <a @click='$router.push(`/data/${data.id}`)' class="card-title cursor-pointer" v-text='data.name'></a>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <SettingsIcon class='cursor-pointer' @click='$router.push(`/data/${data.id}/edit`)'/>
                                </div>
                            </div>
                        </div>
                        <div class="card-body" v-text='data.description'>
                        </div>
                        <div class="card-footer">
                            Last updated <span v-text='timeDiff(data.updated)'/>
                        </div>
                    </div>
                </div>
                <div class="col-lg-12">
                    <DataAsset/>
                </div>
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
import DataAsset from './Data/Assets.vue';
import DataTransforms from './Data/Transforms.vue';
import timeDiff from '../timediff.js';
import {
    TablerLoading,
    TablerBreadCrumb
} from '@tak-ps/vue-tabler'
import {
    SettingsIcon,
} from 'vue-tabler-icons'

export default {
    name: 'DataSingle',
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
        timeDiff(update) {
            return timeDiff(update);
        },
        fetch: async function() {
            this.loading.data = true;
            this.data = await window.std(`/api/data/${this.$route.params.dataid}`);
            this.loading.data = false;
        }
    },
    components: {
        SettingsIcon,
        PageFooter,
        TablerLoading,
        DataAsset,
        DataTransforms,
        TablerBreadCrumb
    }
}
</script>
