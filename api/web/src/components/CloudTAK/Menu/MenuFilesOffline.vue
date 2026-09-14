<template>
    <div class='col-12 pt-2'>
        <TablerInput
            v-model='filter'
            icon='search'
            placeholder='Filter'
        />
    </div>

    <TablerLoading v-if='loading' />
    <TablerNone
        v-else-if='!files.length'
        label='No Offline Files'
        :create='false'
    />
    <div
        v-else
        class='mt-2 d-flex flex-column gap-2'
    >
        <StandardItem
            v-for='file in files'
            :key='file.id'
            class='px-3 py-2'
        >
            <TablerSlidedown
                :click-anywhere-expand='true'
                :click-anywhere-collapse='true'
                :arrow='false'
                :border='false'
            >
                <template #default>
                    <div
                        class='d-flex align-items-center overflow-hidden'
                        role='menuitem'
                        tabindex='0'
                    >
                        <div class='col-auto'>
                            <TablerIconButton
                                class='flex-shrink-0'
                                :title='overlayTitle(file)'
                                :disabled='!canCreateOverlay(file)'
                                @click.stop.prevent='canCreateOverlay(file) && emit("create-overlay", file)'
                            >
                                <IconMapPlus
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                        <div class='flex-grow-1 min-width-0 overflow-hidden'>
                            <div class='col-12 px-2 user-select-none overflow-hidden'>
                                <span
                                    class='d-block text-truncate'
                                    :title='file.name'
                                    v-text='file.name'
                                />
                            </div>
                            <div class='col-12 subheader d-flex align-items-center gap-2 px-2 min-width-0'>
                                <span class='mx-2 user-select-none'>
                                    <TablerBytes :bytes='offlineSize(file)' /> - <TablerEpoch :date='file.updated' />
                                </span>
                                <div class='ms-auto d-flex align-items-center gap-1 flex-shrink-0'>
                                    <TablerBadge
                                        class='small'
                                        background-color='rgba(32, 107, 196, 0.15)'
                                        border-color='rgba(32, 107, 196, 0.35)'
                                        text-color='#206bc4'
                                        title='Available offline on this device'
                                    >
                                        Offline
                                    </TablerBadge>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
                <template #expanded>
                    <div
                        :class='[
                            "rounded col-12 d-flex align-items-center px-2 py-2 user-select-none",
                            canCreateOverlay(file) ? "cursor-pointer cloudtak-hover" : "opacity-50 pe-none"
                        ]'
                        role='menuitem'
                        :tabindex='canCreateOverlay(file) ? 0 : -1'
                        :aria-disabled='!canCreateOverlay(file)'
                        @click.stop.prevent='canCreateOverlay(file) && emit("create-overlay", file)'
                        @keyup.enter='canCreateOverlay(file) && emit("create-overlay", file)'
                    >
                        <IconMapPlus
                            :size='32'
                            stroke='1'
                        />
                        <span
                            class='mx-2'
                            v-text='overlayTitle(file)'
                        />
                    </div>

                    <TablerDelete
                        displaytype='menu'
                        class='cloudtak-hover rounded'
                        label='Remove from Device'
                        @delete='remove(file)'
                    />
                </template>
            </TablerSlidedown>
        </StandardItem>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Subscription } from 'dexie';
import type { DBProfileFile } from '../../../database.ts';
import ProfileFileManager from '../../../base/profile-file.ts';
import { useMapStore } from '../../../stores/map.ts';
import StandardItem from '../util/StandardItem.vue';
import {
    TablerInput,
    TablerLoading,
    TablerNone,
    TablerDelete,
    TablerSlidedown,
    TablerBadge,
    TablerIconButton,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';
import { IconMapPlus } from '@tabler/icons-vue';

const props = defineProps<{
    overlayUrls: Set<string>;
    isOffline: boolean;
}>();

const emit = defineEmits<{
    'create-overlay': [asset: DBProfileFile];
}>();

const mapStore = useMapStore();

const filter = ref('');
const loading = ref(true);
const records = ref<DBProfileFile[]>([]);
let subscription: Subscription | undefined;

onMounted(() => {
    subscription = ProfileFileManager.liveList().subscribe({
        next: (items) => {
            records.value = items;
            loading.value = false;
        },
        error: (err) => {
            console.warn('Failed to list offline files', err);
            loading.value = false;
        }
    });
});

onUnmounted(() => {
    subscription?.unsubscribe();
});

const files = computed(() => {
    const term = filter.value.trim().toLowerCase();

    return records.value.filter((file) => {
        if (!mapStore.offlineTiles.has(file.id)) return false;
        return !term || file.name.toLowerCase().includes(term);
    });
});

function offlineSize(file: DBProfileFile): number {
    return file.artifacts.find((artifact) => artifact.ext === '.pmtiles')?.size ?? file.size;
}

function overlayExists(file: DBProfileFile): boolean {
    return props.overlayUrls.has(`/api/profile/asset/${encodeURIComponent(file.id)}.pmtiles/tile`);
}

function canCreateOverlay(file: DBProfileFile): boolean {
    return !props.isOffline && !overlayExists(file);
}

function overlayTitle(file: DBProfileFile): string {
    if (overlayExists(file)) return 'Overlay already added';
    if (props.isOffline) return 'Connect to add to Map as Overlay';
    return 'Add to Map as Overlay';
}

async function remove(file: DBProfileFile) {
    await mapStore.worker.tiles.remove(file.id);
}
</script>
