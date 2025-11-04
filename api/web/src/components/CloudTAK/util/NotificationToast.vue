<template>
    <teleport to='body'>
        <div
            class='toast-container position-fixed'
            style='
                right: 70px;
                bottom: 10px;
            '
        >
            <div
                id='toast-simple'
                class='toast fade show'
                role='alert'
                aria-live='assertive'
                aria-atomic='true'
                data-bs-autohide='false'
            >
                <div class='toast-header'>
                    <span class='me-2'>
                        <NotificationIcon
                            :type='props.type'
                            :size='24'
                        />
                    </span>
                    <strong
                        v-if='props.name'
                        class='me-auto'
                        v-text='props.name'
                    />
                    <small
                        v-if='props.created'
                        v-text='timediff(props.created)'
                    />
                    <button
                        type='button'
                        class='ms-2 btn-close'
                        title='close'
                        @click='emit("close")'
                    />
                </div>
                <div class='toast-body'>
                    <span v-body='props.body' />
                </div>
                <div class='loading-bar' />
            </div>
        </div>
    </teleport>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';
import NotificationIcon from './NotificationIcon.vue';
import timediff from '../../../timediff.ts';

const timer = ref<ReturnType<typeof setTimeout> | null>(null);

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const props = withDefaults(defineProps<{
    name: string;
    type: string;
    body: string;
    created?: string;
    timeout?: number;
}>(), {
    timeout: 3000
});

onMounted(() => {
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
    animation: shrink 3s linear forwards;
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

