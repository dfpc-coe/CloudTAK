<template>
    <teleport to='body'>
        <div
            v-if='notification'
            class='notification-toast cloudtak-panel position-fixed overflow-hidden user-select-none'
            :class='{ "cursor-pointer": notification.url }'
            :style='`
                bottom: ${mapStore.toastOffset.y}px;
                right: ${mapStore.toastOffset.x}px;
            `'
            role='alert'
            aria-live='assertive'
            aria-atomic='true'
            @click='navigateTo'
        >
            <div class='d-flex align-items-center gap-2 px-2 py-2'>
                <div class='notification-toast-icon d-flex align-items-center justify-content-center rounded-circle flex-shrink-0'>
                    <NotificationIcon
                        :type='notification.type'
                        :size='24'
                    />
                </div>
                <div
                    class='flex-grow-1'
                    style='min-width: 0;'
                >
                    <div class='d-flex align-items-baseline gap-2'>
                        <div
                            class='fw-bold text-truncate'
                            v-text='notification.name'
                        />
                        <small
                            class='text-secondary text-nowrap ms-auto'
                            v-text='timediff(notification.created)'
                        />
                    </div>
                    <div
                        v-if='notification.body'
                        class='notification-toast-body text-secondary small'
                        v-text='notification.body'
                    />
                </div>
                <TablerIconButton
                    title='Dismiss'
                    class='flex-shrink-0'
                    @click.stop='emit("close")'
                >
                    <IconX
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
            <div
                class='notification-toast-progress'
                :style='`animation-duration: ${props.timeout}ms;`'
            />
        </div>
    </teleport>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import TAKNotification from '../../../base/notification.ts';
import NotificationIcon from './NotificationIcon.vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconX } from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';
import timediff from '../../../timediff.ts';

const router = useRouter();
const timer = ref<ReturnType<typeof setTimeout> | null>(null);

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const props = withDefaults(defineProps<{
    id: string;
    timeout?: number;
}>(), {
    timeout: 5000,
});

const notification = ref<TAKNotification | null>(null);
const mapStore = useMapStore();

onMounted(async () => {
    notification.value = await TAKNotification.from(props.id);

    timer.value = setTimeout(() => {
        if (timer.value) {
            clearTimeout(timer.value);
        }
        emit('close');
    }, props.timeout);
});

onUnmounted(() => {
    if (timer.value) {
        clearTimeout(timer.value);
    }
});

function navigateTo() {
    if (notification.value?.url) {
        router.push(notification.value.url);
        emit('close');
    }
}
</script>

<style scoped>
.notification-toast {
    z-index: 1090;
    width: min(340px, calc(100vw - 16px));
    transition: border-color 0.15s ease;
    animation: notification-toast-in 0.2s ease-out;
}

.notification-toast.cursor-pointer:hover {
    border-color: var(--cloudtak-hover-border);
}

.notification-toast-icon {
    width: 40px;
    height: 40px;
    background-color: var(--cloudtak-inset-bg);
    border: 1px solid var(--cloudtak-inset-border);
}

.notification-toast-body {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
}

.notification-toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    width: 100%;
    background-color: var(--tblr-primary);
    transform-origin: left;
    animation: notification-toast-shrink linear forwards;
}

@keyframes notification-toast-in {
    from {
        opacity: 0;
        transform: translateY(8px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes notification-toast-shrink {
    from {
        transform: scaleX(1);
    }
    to {
        transform: scaleX(0);
    }
}

@media (prefers-reduced-motion: reduce) {
    .notification-toast {
        animation: none;
    }
}
</style>
