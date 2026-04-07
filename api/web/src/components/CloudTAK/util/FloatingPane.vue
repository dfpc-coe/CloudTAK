<template>
    <div
        ref='container'
        class='position-absolute cloudtak-bg rounded border resizable-content text-white'
    >
        <div
            style='height: 50px;'
            class='d-flex align-items-center px-2 py-2 border-bottom border-secondary'
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

            <slot name='header' />

            <div class='btn-list ms-auto'>
                <slot name='actions' />

                <TablerIconButton
                    title='Close Pane'
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
            class='modal-body'
            :style='`height: calc(100% - 50px)`'
        >
            <slot />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { useFloatStore } from '../../../stores/float.ts';
import {
    IconX,
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

const pane = ref(floatStore.panes.get(props.uid));
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

        window.requestAnimationFrame(() => {
            if (pane.value && container.value) {
                pane.value.height = entries[0].contentRect.height;
                pane.value.width = entries[0].contentRect.width;
            }
        });
    })

    if (container.value && pane.value) {
        container.value.style.top = pane.value.y + 'px';
        container.value.style.left = pane.value.x + 'px';

        container.value.style.height = pane.value.height + 'px';
        container.value.style.width = pane.value.width + 'px';

        observer.value.observe(container.value);
    }

    if (dragHandle.value) {
        dragHandle.value.addEventListener('mousedown', dragStart);
        dragHandle.value.addEventListener('touchstart', touchStart, { passive: false });
    }
});

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

    pane.value.x = dragElRect.left + event.clientX - lastPosition.value.left;
    pane.value.y = dragElRect.top + event.clientY - lastPosition.value.top;

    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    container.value.style.top = pane.value.y + 'px';
    container.value.style.left = pane.value.x + 'px';
}

function dragEnd() {
    if (!container.value || !dragHandle.value) return;

    container.value.removeEventListener('mousemove', dragMove);
    container.value.removeEventListener('mouseleave', dragEnd);
    container.value.removeEventListener('mouseup', dragEnd);

    dragHandle.value.classList.remove('dragging');
}

function touchStart(event: TouchEvent) {
    if (!container.value || !dragHandle.value) return;
    event.preventDefault();

    const touch = event.touches[0];
    lastPosition.value.left = touch.clientX;
    lastPosition.value.top = touch.clientY;

    dragHandle.value.classList.add('dragging');

    container.value.addEventListener('touchmove', touchMove, { passive: false });
    container.value.addEventListener('touchend', touchEnd);
    container.value.addEventListener('touchcancel', touchEnd);
}

function touchMove(event: TouchEvent) {
    if (!container.value || !dragHandle.value || !pane.value) return;
    event.preventDefault();

    const touch = event.touches[0];
    const dragElRect = container.value.getBoundingClientRect();

    pane.value.x = dragElRect.left + touch.clientX - lastPosition.value.left;
    pane.value.y = dragElRect.top + touch.clientY - lastPosition.value.top;

    lastPosition.value.left = touch.clientX;
    lastPosition.value.top = touch.clientY;

    container.value.style.top = pane.value.y + 'px';
    container.value.style.left = pane.value.x + 'px';
}

function touchEnd() {
    if (!container.value || !dragHandle.value) return;

    container.value.removeEventListener('touchmove', touchMove);
    container.value.removeEventListener('touchend', touchEnd);
    container.value.removeEventListener('touchcancel', touchEnd);

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
    overflow: hidden;
}
</style>
