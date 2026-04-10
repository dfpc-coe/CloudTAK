<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <span class='modal-title'>Row Editor</span>
            <div class='ms-auto'>
                <TablerDelete
                    v-if='!disabled'
                    displaytype='icon'
                    @delete='emit("remove")'
                />
            </div>
        </div>
        <div
            v-if='!loading'
            class='modal-body py-4'
        >
            <TablerSchema
                v-model='row'
                :schema='schema'
                :disabled='disabled'
            />

            <button
                v-if='!disabled'
                class='btn btn-primary w-100 mt-4'
                @click='emit("done", row)'
            >
                Done
            </button>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import {
    TablerModal,
    TablerSchema,
    TablerDelete
} from '@tak-ps/vue-tabler';

const props = withDefaults(defineProps<{
    edit: Record<string, unknown>;
    disabled?: boolean;
    schema: Record<string, unknown>;
}>(), {
    disabled: true,
});

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'remove'): void;
    (e: 'done', value: Record<string, unknown>): void;
}>();

const loading = ref(true);
const row = ref<Record<string, unknown>>({});

onMounted(() => {
    row.value = Object.assign(row.value, JSON.parse(JSON.stringify(props.edit)));
    loading.value = false;
})
</script>
