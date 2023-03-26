<template>
<div class='card'>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Data Assets</h3>

        <div class='ms-auto'>
            <PlusIcon @click='upload = true' class='cursor-pointer'/>
        </div>
    </div>

    <div class='card-body'>
        <TablerLoading v-if='loading.list'/>
        <Upload
            v-else-if='upload'
            :url='uploadURL()'
            :headers='uploadHeaders()'
            @cancel='upload = false'
        />
        <None v-else-if='!assets.length' :create='false'/>
    </div>
</div>
</template>

<script>
import {
    PlusIcon
} from 'vue-tabler-icons'
import None from '../cards/None.vue';
import Upload from '../util/Upload.vue';
import {
    TablerLoading
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
            assets: []
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
        fetchList: async function() {
            this.loading.list = true;
            this.assets = await window.std(`/api/data/${this.$route.params.dataid}/asset`);
            this.loading.list = false;
        }
    },
    components: {
        None,
        Upload,
        PlusIcon,
        TablerLoading
    }
}
</script>
