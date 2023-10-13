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
                                <FileUploadIcon v-if='!upload' @click='upload = true' v-tooltip='"Zip Upload"' class='cursor-pointer'/>
                                <PlusIcon v-tooltip='"Manual Creation"' @click='$router.push(`/iconset/new`)' class='cursor-pointer'/>
                                <RefreshIcon v-tooltip='"Refresh"' @click='fetchList' class='cursor-pointer'/>
                            </div>
                        </div>
                        <TablerLoading v-if='loading'/>
                        <template v-else-if='upload'>
                            <Upload
                                method='PUT'
                                :url='uploadURL()'
                                :headers='uploadHeaders()'
                                @done='processUpload($event)'
                                @cancel='upload = false'
                                @err='throws($event)'
                            />
                        </template>
                        <TablerNone
                            v-else-if='!list.iconsets.length'
                            label='Iconsets'
                            :create='false'
                        />
                        <div v-else class='table-responsive'>
                            <table class="table table-hover card-table table-vcenter cursor-pointer">
                                <thead><tr>
                                    <th>Name</th>
                                    <th>UID</th>
                                </tr></thead>
                                <tbody><tr @click='$router.push(`/iconset/${iconset.uid}`)' :key='iconset.uid' v-for='iconset in list.iconsets'>
                                    <td v-text='iconset.name'></td>
                                    <td v-text='iconset.uid'></td>
                                </tr></tbody>
                            </table>
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
import Upload from './util/Upload.vue';
import CombinedIcons from './cards/Icons.vue'
import {
    TablerNone,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    RefreshIcon,
    SearchIcon,
    FileUploadIcon,
    PlusIcon
} from 'vue-tabler-icons'

export default {
    name: 'Icons',
    data: function() {
        return {
            err: false,
            loading: true,
            upload: false,
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
        throws: function(err) {
            throw err;
        },
        processUpload: function(body) {
            body = JSON.parse(body);
            this.$router.push(`/import/${body.imports[0].uid}`);
        },
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadURL: function() {
            return window.stdurl(`/api/import`);
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/iconset');
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        Upload,
        PlusIcon,
        FileUploadIcon,
        CombinedIcons,
        TablerNone,
        SearchIcon,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading,
        RefreshIcon,
    }
}
</script>
