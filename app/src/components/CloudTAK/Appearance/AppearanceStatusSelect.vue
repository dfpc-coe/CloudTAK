<template>
    <div
        ref='root'
        class='position-relative'
    >
        <label class='subheader user-select-none d-block pb-1'>Status</label>

        <button
            type='button'
            class='status-trigger w-100 d-flex align-items-center rounded border px-2 py-2 text-start'
            :class='{ "status-trigger--open": open }'
            :aria-expanded='open'
            @click='open = !open'
        >
            <StatusBar :status='status' />

            <div
                class='flex-grow-1 mx-2'
                style='min-width: 0;'
            >
                <div
                    class='text-truncate'
                    v-text='current.label'
                />
                <div
                    class='text-secondary small text-truncate'
                    v-text='current.meaning'
                />
            </div>

            <IconChevronUp
                v-if='open'
                :size='18'
                stroke='1.5'
            />
            <IconChevronDown
                v-else
                :size='18'
                stroke='1.5'
            />
        </button>

        <div
            v-if='open'
            class='status-panel card position-absolute start-0 end-0 mt-1 shadow px-1 py-1'
            role='listbox'
        >
            <button
                v-for='opt of STATUS_OPTIONS'
                :key='opt.value'
                type='button'
                role='option'
                class='status-item w-100 d-flex align-items-center rounded px-2 py-1 text-start cloudtak-hover'
                :class='{ "status-item--active": opt.value === status }'
                :aria-selected='opt.value === status'
                @click='select(opt.value)'
            >
                <StatusBar :status='opt.value' />
                <div
                    class='flex-grow-1 mx-2'
                    style='min-width: 0;'
                >
                    <div
                        class='text-truncate'
                        v-text='opt.label'
                    />
                    <div
                        class='text-secondary small text-truncate'
                        v-text='opt.meaning'
                    />
                </div>
                <IconCheck
                    v-if='opt.value === status'
                    :size='16'
                    stroke='2'
                    class='text-primary'
                />
            </button>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted, useTemplateRef } from 'vue';
import { IconCheck, IconChevronUp, IconChevronDown } from '@tabler/icons-vue';
import StatusBar from './StatusBar.vue';
import { STATUS_OPTIONS, statusOf, withStatus } from '../../../utils/appearance.ts';

const props = defineProps<{
    /** Numeric SIDC the status digit is read from and written into */
    modelValue: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', type: string): void;
}>();

const root = useTemplateRef<HTMLElement>('root');

const open = ref(false);

const status = computed<string>(() => statusOf(props.modelValue));

const current = computed(() => {
    return STATUS_OPTIONS.find((opt) => opt.value === status.value) || STATUS_OPTIONS[0];
});

onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown);
});

onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDown);
});

function onPointerDown(event: PointerEvent): void {
    if (open.value && root.value && !root.value.contains(event.target as Node)) {
        open.value = false;
    }
}

function select(value: string): void {
    emit('update:modelValue', withStatus(props.modelValue, value));
    open.value = false;
}
</script>

<style scoped>
.status-trigger {
    background: var(--tblr-bg-surface, transparent);
    color: inherit;
}

.status-trigger--open {
    border-color: var(--tblr-primary) !important;
}

.status-panel {
    z-index: 1030;
}

.status-item {
    border: 0;
    background: transparent;
    color: inherit;
}

.status-item--active {
    background: color-mix(in srgb, var(--tblr-primary) 10%, transparent);
}
</style>
