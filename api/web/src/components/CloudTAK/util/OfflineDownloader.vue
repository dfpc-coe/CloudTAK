<template>
    <div
        class='d-flex flex-column px-3 py-2 user-select-none'
        :class='{ "cursor-pointer cloudtak-hover": !downloading }'
        role='menuitem'
        :tabindex='downloading ? -1 : 0'
        :aria-busy='downloading'
        @click.stop.prevent='download'
        @keyup.enter='download'
    >
        <div class='d-flex align-items-center'>
            <IconCircleCheck
                v-if='available && !downloading'
                :size='24'
                stroke='1'
                class='text-success'
            />
            <IconCloudDownload
                v-else
                :size='24'
                stroke='1'
            />
            <span class='mx-2'>{{ label }}</span>
        </div>
        <TablerProgress
            v-if='downloading'
            class='mt-2'
            :percent='progress'
        />
        <div
            v-if='error'
            class='text-danger small mt-1'
            v-text='error'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import * as Comlink from 'comlink';
import type { ProfileFile } from '../../../types.ts';
import { useMapStore } from '../../../stores/map.ts';
import { TablerProgress } from '@tak-ps/vue-tabler';
import {
    IconCircleCheck,
    IconCloudDownload
} from '@tabler/icons-vue';

const props = defineProps<{
    asset: ProfileFile;
}>();

const emit = defineEmits<{
    'done': [asset: ProfileFile];
}>();

const mapStore = useMapStore();

const available = ref(false);
const downloading = ref(false);
const progress = ref(0);
const error = ref<string | null>(null);

const label = computed(() => {
    if (downloading.value) return 'Downloading for Offline Use';
    if (available.value) return 'Available Offline';
    return 'Make Available Offline';
});

onMounted(async () => {
    available.value = await mapStore.worker.tiles.has(props.asset.id);
});

async function download() {
    if (downloading.value || available.value) return;

    downloading.value = true;
    progress.value = 0;
    error.value = null;

    try {
        const expectedSize = props.asset.artifacts.find((artifact) => artifact.ext === '.pmtiles')?.size;

        await mapStore.worker.tiles.download(props.asset.id, expectedSize, Comlink.proxy((percent: number) => {
            progress.value = percent;
        }));

        available.value = true;
        emit('done', props.asset);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    } finally {
        downloading.value = false;
    }
}
</script>
