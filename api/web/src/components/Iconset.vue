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
                            <h3 class='card-title'>Iconset <span v-text='iconset.name'/></h3>

                            <div class='ms-auto btn-list'>
                                <IconPlus v-tooltip='"Create Icon"' @click='$router.push(`/iconset/${$route.params.icon}/icon`)' class='cursor-pointer'/>
                                <IconDownload v-tooltip='"Download TAK Zip"' class='cursor-pointer' @click.stop='download'/>
                                <TablerDelete displaytype='icon' @delete='deleteIconset'/>
                            </div>
                        </div>
                        <TablerLoading v-if='loading'/>
                    </div>
                </div>

                <div class="col-lg-12">
                    <CombinedIcons v-if='!loading' :iconset='iconset.uid'/>
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
    IconPlus,
    IconDownload
} from '@tabler/icons-vue';

export default {
    name: 'Iconset',
    data: function() {
        return {
            loading: true,
            iconset: {
                uid: ''
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        download: async function() {
            window.location.href = window.stdurl(`api/iconset/${this.iconset.uid}?format=zip&download=true&token=${localStorage.token}`);
        },
        fetch: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/iconset/${this.$route.params.icon}`);
            this.iconset = await window.std(url);
            this.loading = false;
        },
        deleteIconset: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/iconset/${this.$route.params.icon}`);
            this.iconset = await window.std(url, {
                method: 'DELETE'
            });
            this.$router.push('/iconset');
        }
    },
    components: {
        IconPlus,
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
