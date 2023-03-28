<template>
<div class='card'>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Data Assets</h3>

        <div class='ms-auto'>
            <PlusIcon @click='upload = true' class='cursor-pointer'/>
        </div>
    </div>

    <div v-if='!upload && !loading.list && list.assets.length'>
        <table class="table table-vcenter card-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                <tr :key='asset.name' v-for='asset in list.assets'>
                    <td v-text='asset.name'></td>
                    <td>
                        <TablerBytes :bytes='asset.size'/>
                    </td>
                    <td class='d-flex'>
                        <TablerEpoch :date='asset.updated'/>
                        <div class='ms-auto'>
                            <TrashIcon @click='deleteAsset(asset)' class='cursor-pointer'/>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div v-else class='card-body'>
        <TablerLoading v-if='loading.list'/>
        <Upload
            v-else-if='upload'
            :url='uploadURL()'
            :headers='uploadHeaders()'
            @cancel='upload = false'
            @done='fetchList'
        />
        <None v-else-if='!list.assets.length' :create='false'/>
    </div>
</div>
</template>

<script>
import {
    PlusIcon,
    TrashIcon
} from 'vue-tabler-icons'
import None from '../cards/None.vue';
import Upload from '../util/Upload.vue';
import {
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataAssets',
    props: {
    },
    data: function() {
        return {
            upload: false,
            loading: {
                list: true
            },
            list: {
                total: 0,
                assets: []
            }
        };
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadURL: function() {
            return window.stdurl(`/api/data/${this.$route.params.dataid}/asset`);
        },
        deleteAsset: async function(asset) {
            this.loading.list = true;
            await window.std(`/api/data/${this.$route.params.dataid}/asset/${asset.name}`, {
                method: 'DELETE'
            });

            this.fetchList();
        },
        fetchList: async function() {
            this.upload = false;

            this.loading.list = true;
            this.list = await window.std(`/api/data/${this.$route.params.dataid}/asset`);
            this.loading.list = false;
        }
    },
    components: {
        None,
        Upload,
        PlusIcon,
        TrashIcon,
        TablerLoading,
        TablerBytes,
        TablerEpoch
    }
}
</script>
