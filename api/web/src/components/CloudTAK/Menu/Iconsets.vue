<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>Iconsets</div>
            <div class='btn-list'>
                <IconPlus @click='editModal = {}' size='32' class='cursor-pointer' v-tooltip='"Create Iconset"'/>
                <IconFileUpload v-if='!upload' @click='upload = true' v-tooltip='"Zip Upload"' size='32' class='cursor-pointer'/>
                <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <template v-if='upload'>
        <div class='mx-4 my-4'>
            <Upload
                method='PUT'
                :url='uploadURL()'
                :headers='uploadHeaders()'
                @done='processUpload($event)'
                @cancel='upload = false'
                @err='throws($event)'
            />
        </div>
    </template>
    <template v-else>
        <TablerNone
            v-if='!list.items.length'
            label='Iconsets'
            :create='false'
        />
        <div v-else class='table-responsive'>
            <table class="table table-hover card-table table-vcenter cursor-pointer">
                <thead><tr>
                    <th>Name</th>
                </tr></thead>
                <tbody><tr @click='$router.push(`/menu/iconset/${iconset.uid}`)' :key='iconset.uid' v-for='iconset in list.items'>
                    <td>
                        <div class='d-flex align-items-center'>
                            <span v-text='iconset.name'/>
                            <div class='ms-auto'>
                                <IconDownload v-tooltip='"Download TAK Zip"' size='32' class='cursor-pointer' @click.stop='download(iconset)'/>
                            </div>
                        </div>
                    </td>
                </tr></tbody>
            </table>
        </div>

        <div class="col-lg-12">
            <IconCombineds v-if='list.items.length' :labels='false'/>
        </div>
    </template>

    <IconsetEditModal v-if='editModal' @close='editModal = false'/>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import Upload from '../../util/Upload.vue';
import IconCombineds from '../util/Icons.vue'
import IconsetEditModal from './Iconset/EditModal.vue';
import {
    TablerNone,
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
    IconRefresh,
    IconDownload,
    IconFileUpload,
    IconPlus
} from '@tabler/icons-vue'

export default {
    name: 'CloudTAKIconsets',
    data: function() {
        return {
            err: false,
            loading: true,
            upload: false,
            editModal: false,
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
            this.$router.push(`/menu/import/${body.imports[0].uid}`);
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
        IconsetEditModal,
        IconCircleArrowLeft,
        IconFileUpload,
        IconCombineds,
        TablerNone,
        IconRefresh,
    }
}
</script>
