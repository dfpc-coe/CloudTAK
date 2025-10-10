<template>
    <div
        ref='container'
        class='position-absolute bg-dark rounded border resizable-content text-white'
    >
        <div
            style='height: 40px;'
            class='d-flex align-items-center px-2 py-2'
        >
            <div
                ref='drag-handle'
                class='cursor-pointer'
            >
                <IconGripVertical
                    :size='24'
                    stroke='1'
                />
            </div>

            <div
                v-if='pane ? pane.config.attachment : "Attachment"'
                class='text-sm text-truncate'
                style='width: calc(100% - 100px);'
                v-text='pane.config.attachment.name'
            />

            <div class='btn-list ms-auto'>
                <TablerIconButton
                    title='Download'
                    @click='downloadAsset(pane.config.attachment)'
                >
                    <IconDownload
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Close Video Player'
                    @click='emit("close")'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-if='pane'
            class='modal-body'
            :style='`height: calc(100% - 40px)`'
        >
            <img
                v-if='[".png", ".jpg", "jpeg", "webp"].includes(pane.config.attachment.ext)'
                :src='String(downloadAssetUrl(pane.config.attachment))'
                style='
                    width: 100%;
                    height: 100%;
                }'
            >
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { stdurl } from '../../../std.ts';
import type { Attachment } from '../../../types.ts';
import { useFloatStore } from '../../../stores/float.ts';
import type { AttachmentPane } from '../../../stores/float.ts';
import {
    IconX,
    IconDownload,
    IconGripVertical
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

const container = useTemplateRef<HTMLElement>('container');
const dragHandle = useTemplateRef<HTMLElement>('drag-handle');

const emit = defineEmits(['close']);

const pane = ref(floatStore.panes.get(props.uid) as AttachmentPane);
const observer = ref<ResizeObserver | undefined>();
const lastPosition = ref({ top: 0, left: 0 })

onUnmounted(async () => {
    if (observer.value) {
        observer.value.disconnect();
    }
});

onMounted(async () => {
    observer.value = new ResizeObserver((entries) => {
        if (!entries.length) return;

        if (pane.value && container.value) {
            pane.value.config.height = entries[0].contentRect.height;
            pane.value.config.width = entries[0].contentRect.width;
        }
    })

    if (container.value && pane.value) {
        container.value.style.top = pane.value.config.y + 'px';
        container.value.style.left = pane.value.config.x + 'px';

        container.value.style.height = pane.value.config.height + 'px';
        container.value.style.width = pane.value.config.width + 'px';

        observer.value.observe(container.value);
    }

    if (dragHandle.value) {
        dragHandle.value.addEventListener('mousedown', dragStart);
    }
});

function downloadAssetUrl(attachment: Attachment) {
    const url = stdurl(`/api/attachment/${attachment.hash}`);
    url.searchParams.append('token', localStorage.token);
    return url;
}

async function downloadAsset(attachment: Attachment) {
    window.open(String(downloadAssetUrl(attachment)), "_blank")
}

function dragStart(event: MouseEvent) {
    if (!container.value || !dragHandle.value) return;

    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    dragHandle.value.classList.add('dragging');

    container.value.addEventListener('mousemove', dragMove);
    container.value.addEventListener('mouseleave', dragEnd);
    container.value.addEventListener('mouseup', dragEnd);
}

function dragMove(event: MouseEvent) {
    if (!container.value || !dragHandle.value || !pane.value) return;


    const dragElRect = container.value.getBoundingClientRect();

    pane.value.config.x = dragElRect.left + event.clientX - lastPosition.value.left;
    pane.value.config.y = dragElRect.top + event.clientY - lastPosition.value.top;

    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    container.value.style.top = pane.value.config.y + 'px';
    container.value.style.left = pane.value.config.x + 'px';
}

function dragEnd() {
    if (!container.value || !dragHandle.value) return;

    container.value.removeEventListener('mousemove', dragMove);
    container.value.removeEventListener('mouseleave', dragEnd);
    container.value.removeEventListener('mouseup', dragEnd);

    dragHandle.value.classList.remove('dragging');
}

</script>

<style>
.dragging {
    cursor: move !important;
}

.resizable-content {
    min-height: 300px;
    min-width: 400px;
    resize: both;
    overflow: auto;
}
</style>
