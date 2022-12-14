<template>
<div class='row'>
    <div class='col-12 d-flex'>
        <div class='py-2'>
            <FolderIcon/><span class='px-2' v-text='asset.name'/>
        </div>

        <div class='ms-auto'>
            <div @click='download' class='btn btn-sm'><DownloadIcon/></div>
        </div>
    </div>
</div>
</template>

<script>
import {
    FolderIcon,
    DownloadIcon
} from 'vue-tabler-icons'

export default {
    name: 'Asset',
    props: {
        asset_id: {
            type: Number,
            required: true
        }
    },
    data: function() {
        return {
            asset: {}
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.asset = await window.std(`/api/asset/${this.asset_id}`);
        },
        download: function() {
            window.open(window.stdurl(`/api/asset/${this.asset_id}/raw`), "_blank")
        }
    },
    components: {
        FolderIcon,
        DownloadIcon
    }
}
</script>
