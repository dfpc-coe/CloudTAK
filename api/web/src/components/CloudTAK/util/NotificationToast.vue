<template>
    <teleport to='body'>
        <div
            v-if='notification'
            class='toast-container position-fixed cursor-pointer'
            :style='`
                bottom: ${mapStore.toastOffset.y}px;
                right: ${mapStore.toastOffset.x}px;
            `'
            @click='navigateTo'
        >
            <div
                class='toast show'
                role='alert'
                aria-live='assertive'
                aria-atomic='true'
                data-bs-autohide='false'
            >
                <div class='toast-header'>
                    <span class='me-2'>
                        <NotificationIcon
                            :type='notification.type'
                            :size='24'
                        />
                    </span>
                    <strong
                        class='me-auto'
                        v-text='notification.name'
                    />
                    <small
                        v-text='timediff(notification.created)'
                    />
                    <button
                        type='button'
                        class='ms-2 btn-close'
                        title='close'
                        @click.stop='emit("close")'
                    />
                </div>
                <div class='toast-body'>
                    <span v-text='notification.body' />
                </div>
                <div class='loading-bar' />
            </div>
        </div>
    </teleport>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import TAKNotification from '../../../base/notification.ts';
import NotificationIcon from './NotificationIcon.vue';
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
.toast {
    position: relative;
    overflow: hidden;
}

.loading-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 4px;
    width: 100%;

    background-color: var(--bs-primary, #0d6efd);
    animation: shrink 5s linear forwards;
}

@keyframes shrink {
    from {
        width: 100%;
    }
    to {
        width: 0%;
    }
}
</style>

