<template>
    <div class='row'>
        <div class='col-12 d-flex'>
            <div class='py-2'>
                <IconFolder :size='32' :stroke='1'/><span
                    class='px-2'
                    v-text='asset.name'
                />
            </div>

            <div class='ms-auto'>
                <div
                    class='btn btn-sm'
                    @click='download'
                >
                    <IconDownload :size='32' :stroke='1'/>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconFolder,
    IconDownload
} from '@tabler/icons-vue'

export default {
    name: 'GenericAsset',
    components: {
        IconFolder,
        IconDownload
    },
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
            this.asset = await std(`/api/asset/${this.asset_id}`);
        },
        download: function() {
            window.open(stdurl(`/api/asset/${this.asset_id}/raw`), "_blank")
        }
    }
}
</script>
