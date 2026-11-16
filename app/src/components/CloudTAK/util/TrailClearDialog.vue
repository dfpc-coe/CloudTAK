<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            :disabled='clearing'
            @click='emit("close")'
        />
        <div class='modal-status bg-red' />
        <div class='modal-header text-center py-4'>
            Deletion Confirmation
        </div>
        <div class='modal-body text-center py-4'>
            <div>Are you sure you wish to perform this deletion?</div>
            <div class='mt-2 small text-muted'>
                The recorded positions of this trail are removed and its live recording stops.
            </div>
            <div
                v-if='error'
                class='mt-3 small text-danger'
                v-text='error'
            />
        </div>
        <div class='modal-footer'>
            <div
                class='btn btn-danger'
                :class='{ "disabled": clearing }'
                @click='clear'
            >
                <TablerLoading
                    v-if='clearing'
                    :inline='true'
                />
                <template v-else>
                    <IconTrash
                        :size='32'
                        stroke='1'
                    /><span class='mx-2'>Clear Trail</span>
                </template>
            </div>
        </div>
    </TablerModal>
</template>
<script setup lang='ts'>
/**
 * The confirmation for clearing a breadcrumb trail, laid out like the one of
 * TablerDelete. It is its own component because the Breadcrumb dropdown closes on
 * any click outside its menu, which would unmount a TablerDelete inside it before
 * the click on the confirm button is handled, so the host of the dropdown owns this
 * instead (TAK.NZ-only).
 */
import { ref } from 'vue';
import { IconTrash } from '@tabler/icons-vue';
import { TablerModal, TablerLoading } from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../stores/map.ts';
const props = defineProps<{
    uid: string
}>();
const emit = defineEmits<{
    close: []
    cleared: []
}>();
const mapStore = useMapStore();
const clearing = ref(false);
const error = ref<string | null>(null);
async function clear(): Promise<void> {
    if (clearing.value) return;
    clearing.value = true;
    error.value = null;
    try {
        await mapStore.worker.db.breadcrumb.remove(props.uid);
        emit('cleared');
        emit('close');
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        clearing.value = false;
    }
}
</script>
