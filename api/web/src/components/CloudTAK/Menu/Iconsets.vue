<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Iconsets</div>
            <div class='btn-list'>
                <IconPlus @click='editModal = {}' size='32' class='cursor-pointer' v-tooltip='"Create BaseMap"'/>
                <IconFileUpload v-if='!upload' @click='upload = true' v-tooltip='"Zip Upload"' size='32' class='cursor-pointer'/>
                <IconSearch @click='query = !query' v-tooltip='"Search"' size='32' class='cursor-pointer'/>
                <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>

    <div v-if='query' class='col-12 px-3'>
        <TablerInput v-model='paging.filter' placeholder='Filter'/>
    </div>
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

    <div class="col-lg-12">
        <IconCombineds v-if='list.items.length'/>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import Upload from '../../util/Upload.vue';
import IconCombineds from '../../cards/Icons.vue'
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
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
        IconCircleArrowLeft,
        IconFileUpload,
        IconCombineds,
        TablerNone,
        IconSearch,
        TablerLoading,
        IconRefresh,
    }
}
</script>