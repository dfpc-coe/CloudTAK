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
                                <IconFileUpload v-if='!upload' @click='upload = true' v-tooltip='"Zip Upload"' size='32' class='cursor-pointer'/>
                                <IconPlus v-tooltip='"Manual Creation"' @click='$router.push(`/iconset/new`)' size='32' class='cursor-pointer'/>
                                <IconRefresh v-tooltip='"Refresh"' @click='fetchList' size='32' class='cursor-pointer'/>
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
                            v-else-if='!list.items.length'
                            label='Iconsets'
                            :create='false'
                        />
                        <div v-else class='table-responsive'>
                            <table class="table table-hover card-table table-vcenter cursor-pointer">
                                <thead><tr>
                                    <th>Name</th>
                                    <th>UID</th>
                                </tr></thead>
                                <tbody><tr @click='$router.push(`/iconset/${iconset.uid}`)' :key='iconset.uid' v-for='iconset in list.items'>
                                    <td v-text='iconset.name'></td>
                                    <td>
                                        <div class='d-flex'>
                                            <span v-text='iconset.uid'/>
                                            <div class='ms-auto'>
                                                <IconDownload v-tooltip='"Download TAK Zip"' size='32' class='cursor-pointer' @click.stop='download(iconset)'/>
                                            </div>
                                        </div>
                                    </td>
                                </tr></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                    <IconCombineds v-if='list.items.length'/>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import { std, stdurl } from '/std.ts';
import PageFooter from './PageFooter.vue';
import Upload from './util/Upload.vue';
import IconCombineds from './cards/Icons.vue'
import {
    TablerNone,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconSearch,
    IconDownload,
    IconFileUpload,
    IconPlus
} from '@tabler/icons-vue'

export default {
    name: 'Iconsets',
    data: function() {
        return {
            err: false,
            loading: true,
            upload: false,
            list: {
                total: 0,
                items: []
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
        download: async function(iconset) {
            window.location.href = stdurl(`api/iconset/${iconset.uid}?format=zip&download=true&token=${localStorage.token}`);
        },
        uploadURL: function() {
            return stdurl(`/api/import`);
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/iconset');
            this.list = await std(url);
            this.loading = false;
        }
    },
    components: {
        Upload,
        IconPlus,
        IconDownload,
        IconFileUpload,
        IconCombineds,
        TablerNone,
        IconSearch,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading,
        IconRefresh,
    }
}
</script>
