<template>
    <FloatingPane
        :uid='uid'
        @close='emit("close")'
    >
        <template #header>
            <div
                v-if='pane ? pane.config.attachment : "Attachment"'
                class='text-sm text-truncate'
                style='width: calc(100% - 100px);'
                v-text='pane.config.attachment.name'
            />
        </template>

        <template #actions>
            <TablerIconButton
                title='Download'
                @click='downloadAsset(pane.config.attachment)'
            >
                <IconDownload
                    :size='24'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <div
            v-if='pane'
            class='h-100 w-100'
        >
            <img
                v-if='[".png", ".jpg", ".jpeg", ".webp"].includes(pane.config.attachment.ext.toLowerCase())'
                :src='String(downloadAssetUrl(pane.config.attachment))'
                style='
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                '
            >
            <template
                v-else
            >
                <div
                    class='d-flex flex-column align-items-center justify-content-center text-muted h-100'
                >
                    <IconEyeOff
                        :size='48'
                        stroke='1'
                        class='mb-2'
                    />
                    <div
                        v-text='`No preview available for ${pane.config.attachment.ext} files.`'
                    />
                </div>
            </template>
        </div>
    </FloatingPane>
</template>

<script setup lang='ts'>
import { ref } from 'vue'
import { stdurl } from '../../../std.ts';
import type { Attachment } from '../../../types.ts';
import { useFloatStore } from '../../../stores/float.ts';
import type { Pane } from '../../../stores/float.ts';
import FloatingPane from './FloatingPane.vue';
import {
    IconEyeOff,
    IconDownload,
} from '@tabler/icons-vue';
import {
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const floatStore = useFloatStore();

const props = defineProps({
    uid: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['close']);

const pane = ref(floatStore.panes.get(props.uid) as Pane);

function downloadAssetUrl(attachment: Attachment & { url?: string }) {
    if (attachment.url) return new URL(attachment.url);

    const url = stdurl(`/api/attachment/${attachment.hash}`);
    url.searchParams.set('token', localStorage.token);
    return url;
}

async function downloadAsset(attachment: Attachment & { url?: string }) {
    window.open(String(downloadAssetUrl(attachment)), "_blank")
}
</script>


