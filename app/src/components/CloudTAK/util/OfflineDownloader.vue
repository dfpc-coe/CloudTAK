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
import { ref, computed, toRaw } from 'vue';
import type { ProfileFile } from '../../../types.ts';
import { useMapStore } from '../../../stores/map.ts';
import { offlineTileDownloads, downloadOfflineTiles } from '../../../stores/modules/offline-tiles.ts';
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

const stored = ref(false);
const error = ref<string | null>(null);

const available = computed(() => stored.value || mapStore.offlineTiles.has(props.asset.id));
const progress = computed(() => offlineTileDownloads.get(props.asset.id) ?? 0);
const downloading = computed(() => offlineTileDownloads.has(props.asset.id));

const label = computed(() => {
    if (downloading.value) return 'Downloading for Offline Use';
    if (available.value) return 'Available Offline';
    return 'Make Available Offline';
});

async function download() {
    if (downloading.value || available.value) return;

    error.value = null;

    try {
        await downloadOfflineTiles(toRaw(props.asset));

        stored.value = true;
        emit('done', props.asset);
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    }
}
</script>
