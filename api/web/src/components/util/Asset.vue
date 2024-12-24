<template>
    <div class='row'>
        <div class='col-12 d-flex'>
            <div class='py-2'>
                <IconFolder
                    :size='32'
                    :stroke='1'
                /><span
                    class='px-2'
                    v-text='asset ? asset.name : "Unknown"'
                />
            </div>

            <div class='ms-auto'>
                <div
                    class='btn btn-sm'
                    @click='download'
                >
                    <IconDownload
                        :size='32'
                        :stroke='1'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import type { Asset } from '../../types.ts'
import { std, stdurl } from '../../std.ts';
import {
    IconFolder,
    IconDownload
} from '@tabler/icons-vue'

const props = defineProps<{
    asset_id: number
}>();

const asset = ref<Asset | undefined>()

onMounted(async () => {
    await fetch();
});

async function fetch() {
    asset = await std(`/api/asset/${props.asset_id}`);
}
function download() {
    window.open(stdurl(`/api/asset/${props.asset_id}/raw`), "_blank")
}
</script>
