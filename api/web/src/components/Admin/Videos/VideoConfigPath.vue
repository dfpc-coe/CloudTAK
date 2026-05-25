<template>
    <TablerModal>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header'>
            <div
                class='modal-title'
                v-text='pathid'
            />
        </div>

        <TablerLoading v-if='loading' />
        <div
            v-else
            class='modal-body row'
        >
            <pre v-text='path.path' />
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { server } from '../../../std.ts';
import {
    TablerModal,
    TablerLoading,
} from '@tak-ps/vue-tabler'

const props = defineProps<{
    pathid: string;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
}>();

const loading = ref<boolean>(true);
const path = ref<Record<string, unknown>>({});

onMounted(async () => {
    await fetchPath();
});

async function fetchPath() {
    loading.value = true;

    const res = await server.GET('/api/video/service/path/{:path}', {
        params: {
            path: {
                ':path': props.pathid
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    path.value = res.data as Record<string, unknown>;
    loading.value = false;
}
</script>
