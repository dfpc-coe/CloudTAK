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
                            <h3 class='card-title'>Icon <span v-text='icon.name'/></h3>

                            <div class='ms-auto btn-list'>
                                <TablerDelete displaytype='icon' @delete='deleteIcon'/>
                                <IconSettings @click='$router.push(`/iconset/${$route.params.iconset}/icon/${encodeURIComponent($route.params.icon)}/edit`)' size='32' class='cursor-pointer'/>
                            </div>
                        </div>
                        <div class='card-body'>
                            <TablerLoading v-if='loading'/>
                            <template v-else>
                                <div class='pb-4'>
                                    <div class='d-flex justify-content-center mt-3'>
                                        <img :src='iconurl(icon)'>
                                    </div>
                                </div>
                                <div class="datagrid">
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>Iconset</div>
                                        <div class='datagrid-content' v-text='icon.iconset'></div>
                                    </div>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>Name</div>
                                        <div class='datagrid-content' v-text='icon.name'></div>
                                    </div>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>Type 2525b</div>
                                        <div class='datagrid-content' v-text='icon.type2525b || "None"'></div>
                                    </div>
                                </div>
                            </template>
                        </div>
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
import CombinedIcons from './cards/Icons.vue'
import {
    TablerNone,
    TablerDelete,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
    IconDownload
} from '@tabler/icons-vue';

export default {
    name: 'Icon',
    data: function() {
        return {
            loading: true,
            icon: {
                id: false
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        iconurl: function() {
            const url = window.stdurl(`/api/iconset/${this.icon.iconset}/icon/${encodeURIComponent(this.icon.name)}/raw`);
            url.searchParams.append('token', localStorage.token);
            return String(url);
        },
        fetch: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/iconset/${this.$route.params.iconset}/icon/${encodeURIComponent(this.$route.params.icon)}`);
            this.icon = await window.std(url);
            this.loading = false;
        },
        deleteIcon: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/iconset/${this.$route.params.iconset}/icon/${encodeURIComponent(this.$route.params.icon)}`);
            this.iconset = await window.std(url, {
                method: 'DELETE'
            });
            this.$router.push(`/iconset/${this.$route.params.iconset}`);
        }
    },
    components: {
        IconSettings,
        IconDownload,
        CombinedIcons,
        TablerDelete,
        TablerNone,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading
    }
}
</script>
