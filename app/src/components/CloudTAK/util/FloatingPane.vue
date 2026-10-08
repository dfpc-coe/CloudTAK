<template>
    <TablerModal
        v-if='isModal'
        size='xl'
    >
        <div
            class='floating-pane-modal-frame w-100 d-flex flex-column overflow-hidden'
            v-bind='$attrs'
        >
            <div
                style='height: 50px;'
                class='d-flex align-items-center px-2 py-2 border-bottom flex-shrink-0'
            >
                <slot name='header' />

                <div class='btn-list ms-auto flex-nowrap'>
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
                class='modal-body flex-grow-1'
                style='min-height: 0;'
            >
                <slot />
            </div>
        </div>
    </TablerModal>
    <div
        v-else
        ref='container'
        class='position-absolute cloudtak-panel resizable-content'
        v-bind='$attrs'
    >
        <div
            style='height: 50px;'
            class='d-flex align-items-center px-2 py-2 border-bottom'
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted, useTemplateRef } from 'vue'
import { useAppStore } from '../../../stores/app.ts';
import { useFloatStore } from '../../../stores/float.ts';
import {
    IconX,
    IconGripVertical
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

defineOptions({ inheritAttrs: false });

const appStore = useAppStore();
const floatStore = useFloatStore();

const props = defineProps({
    uid: {
        type: String,
        required: true
    },
    modal: {
        type: Boolean,
        default: false
    }
});

const container = useTemplateRef<HTMLElement>('container');
const dragHandle = useTemplateRef<HTMLElement>('drag-handle');

const emit = defineEmits(['close']);

const pane = ref(floatStore.panes.get(props.uid));
const observer = ref<ResizeObserver | undefined>();
const lastPosition = ref({ top: 0, left: 0 })

// Small screens can't fit a draggable pane, so the same content is shown as a modal;
// pages without a map force the modal layout
const isModal = computed(() => props.modal || appStore.isMobileDetected);

onUnmounted(() => {
    detachFloating();
});

onMounted(() => {
    attachFloating();
});

watch(isModal, async (modal) => {
    if (modal) {
        detachFloating();
    } else {
        await nextTick();
        attachFloating();
    }
});

function attachFloating() {
    if (!container.value || !pane.value) return;

    observer.value = new ResizeObserver((entries) => {
        if (!entries.length) return;

        window.requestAnimationFrame(() => {
            if (pane.value && container.value) {
                pane.value.height = entries[0].contentRect.height;
                pane.value.width = entries[0].contentRect.width;
            }
        });
    })

    container.value.style.top = pane.value.y + 'px';
    container.value.style.left = pane.value.x + 'px';

    container.value.style.height = pane.value.height + 'px';
    container.value.style.width = pane.value.width + 'px';

    observer.value.observe(container.value);

    if (dragHandle.value) {
        dragHandle.value.addEventListener('mousedown', dragStart);
        dragHandle.value.addEventListener('touchstart', touchStart, { passive: false });
    }
}

function detachFloating() {
    if (observer.value) {
        observer.value.disconnect();
        observer.value = undefined;
    }

    if (dragHandle.value) {
        dragHandle.value.removeEventListener('mousedown', dragStart);
        dragHandle.value.removeEventListener('touchstart', touchStart);
    }
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

/* Near-fullscreen modal on small screens; the status bar inset is subtracted twice
 * to keep the centered modal's top edge clear of the transparent native status bar. */
.floating-pane-modal-frame {
    height: calc(100dvh - 2rem - 2 * var(--status-bar-height, 0px));
    max-height: calc(100dvh - 2rem - 2 * var(--status-bar-height, 0px));
}
</style>
