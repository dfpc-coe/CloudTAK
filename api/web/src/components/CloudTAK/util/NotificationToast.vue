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

const props = defineProps<{
    name: string;
    type: string;
    body: string;
    created?: string;
}>();

onMounted(() => {
    timer.value = setTimeout(() => {
        clearTimeout(timer.value!);
        emit('close');
    }, 3000);
});

onUnmounted(() => {
    if (timer.value) {
        clearTimeout(timer.value);
    }
});

</script>
