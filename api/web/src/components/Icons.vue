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
                            <h3 class='card-title'>Iconsets</h3>

                            <div class='ms-auto btn-list'>
                                <PlusIcon @click='$router.push(`/iconset/new`)' class='cursor-pointer'/>
                            </div>
                        </div>
                        <div class="card-body">
                            <template v-if='loading'>
                                <TablerLoading/>
                            </template>
                            <template v-else>
                                <TablerNone
                                    v-if='!list.iconsets.length'
                                    label='Iconsets'
                                    :create='false'
                                />
                            </template>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                    <CombinedIcons v-if='list.iconsets.length'/>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import CombinedIcons from './cards/Icons.vue'
import {
    TablerNone,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    SearchIcon,
    PlusIcon
} from 'vue-tabler-icons'

export default {
    name: 'Icons',
    data: function() {
        return {
            err: false,
            loading: true,
            list: {
                total: 0,
                iconsets: []
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/iconset');
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        PlusIcon,
        CombinedIcons,
        TablerNone,
        SearchIcon,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading
    }
}
</script>
