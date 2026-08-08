<template>
    <StandardItem @click='$emit("click")'>
        <div class='d-flex align-items-start gap-3 px-3 py-2'>
            <div
                class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 mt-1 flex-shrink-0'
                style='width: 36px; height: 36px;'
            >
                <IconAlertTriangle
                    :size='18'
                    stroke='1.5'
                    class='text-danger'
                />
            </div>

            <div class='flex-grow-1 overflow-hidden'>
                <div class='d-flex align-items-center gap-2'>
                    <span class='fw-semibold text-truncate flex-grow-1'>{{ err.username }}</span>
                    <span class='text-muted small flex-shrink-0'>{{ new Date(err.created).toLocaleString() }}</span>
                </div>
                <div
                    class='text-truncate small'
                    style='opacity: 0.85;'
                    v-text='err.message'
                />
                <div
                    v-if='err.session_id'
                    class='text-muted small font-monospace text-truncate'
                    v-text='err.session_id'
                />
            </div>

            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import StandardItem from './StandardItem.vue';
import { IconAlertTriangle } from '@tabler/icons-vue';
import type { ErrorReport } from '../../../types.ts';

defineProps<{
    err: ErrorReport;
}>();

defineEmits<{
    (e: 'click'): void;
}>();
</script>
