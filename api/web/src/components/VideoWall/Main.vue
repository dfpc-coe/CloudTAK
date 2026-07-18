<template>
    <div class='h-full w-full cloudtak-bg text-white d-flex flex-column video-wall'>
        <div class='d-flex align-items-center px-3 py-2 border-bottom video-wall-header'>
            <img
                class='cloudtak-logo me-2'
                src='/CloudTAKLogo.svg'
                alt='CloudTAK Logo'
                draggable='false'
            >
            <div class='fs-3 fw-bold user-select-none'>
                Video Wall
            </div>

            <div class='btn-list ms-auto'>
                <TablerIconButton
                    title='Refresh Videos'
                    @click='refresh'
                >
                    <IconRefresh
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>

        <div class='flex-grow-1 overflow-auto'>
            <div
                v-if='loading'
                class='d-flex align-items-center justify-content-center h-100'
            >
                <TablerLoading desc='Loading Video Wall' />
            </div>
            <div
                v-else-if='error'
                class='d-flex align-items-center justify-content-center h-100'
            >
                <TablerAlert
                    title='Video Wall Error'
                    :err='error'
                />
            </div>
            <div
                v-else-if='layout.length === 0'
                class='d-flex align-items-center justify-content-center h-100'
            >
                <TablerNone
                    label='No Videos on the Wall'
                    :create='false'
                />
            </div>
            <GridLayout
                v-else
                v-model:layout='layout'
                :col-num='12'
                :row-height='60'
                :margin='[8, 8]'
                :is-draggable='true'
                :is-resizable='true'
                :vertical-compact='true'
                :use-css-transforms='true'
                @layout-updated='saveLayout'
            >
                <GridItem
                    v-for='item in layout'
                    :key='item.i'
                    :i='item.i'
                    :x='item.x'
                    :y='item.y'
                    :w='item.w'
                    :h='item.h'
                    :min-w='2'
                    :min-h='3'
                    drag-allow-from='.video-wall-drag'
                    drag-ignore-from='.video-wall-nodrag'
                >
                    <div class='d-flex flex-column h-100 w-100 cloudtak-panel overflow-hidden'>
                        <div class='d-flex align-items-center px-2 py-1 border-bottom video-wall-drag cursor-move'>
                            <IconGripVertical
                                :size='20'
                                stroke='1'
                            />
                            <div
                                class='text-sm text-truncate mx-2 user-select-none'
                                v-text='names.get(String(item.i)) || "Video Stream"'
                            />
                            <div class='btn-list ms-auto video-wall-nodrag'>
                                <TablerIconButton
                                    title='Remove from Wall'
                                    @click='removeVideo(String(item.i))'
                                >
                                    <IconX
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>
                        <VideoPlayer
                            class='flex-grow-1 overflow-hidden video-wall-nodrag'
                            :lease='leases.get(String(item.i))'
                            @metadata='names.set(String(item.i), $event.name)'
                        />
                    </div>
                </GridItem>
            </GridLayout>
        </div>
    </div>
</template>

<script setup lang='ts'>
/**
 * VideoWall - persistent grid of the user's saved video streams with
 * drag & drop re-ordering, resizing and removal. Videos are pushed onto
 * the wall from the Map View and placement is persisted per-user.
 */

import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { GridLayout, GridItem } from 'grid-layout-plus';
import type { Layout } from 'grid-layout-plus';
import { std, stdurl } from '../../std.ts';
import { registerVideoWall } from '../../lib/video-wall.ts';
import type { ProfileVideoList } from '../../types.ts';
import VideoPlayer from '../util/VideoPlayer.vue';
import {
    IconX,
    IconRefresh,
    IconGripVertical,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const loading = ref(true);
const error = ref<Error | undefined>();

const layout = ref<Layout>([]);

// ProfileVideo ID => Video Lease ID / resolved lease name
const leases = ref<Map<string, number>>(new Map());
const names = reactive(new Map<string, string>());

// Last known server-side positions - used to only PATCH videos that moved
const saved = ref<Map<string, { x: number, y: number, w: number, h: number }>>(new Map());

const saveTimeout = ref<number | undefined>();

let deregister: (() => void) | undefined;

onMounted(async () => {
    deregister = registerVideoWall(() => {
        refresh();
    });

    await listVideos();
});

onUnmounted(() => {
    if (deregister) deregister();

    if (saveTimeout.value) {
        window.clearTimeout(saveTimeout.value);
    }
});

async function refresh(): Promise<void> {
    loading.value = true;
    await listVideos();
}

async function listVideos(): Promise<void> {
    try {
        error.value = undefined;

        const url = stdurl('/api/profile/video');
        url.searchParams.set('limit', '1000');
        const list = await std(url) as ProfileVideoList;

        const items: Layout = [];
        const leaseMap = new Map<string, number>();
        const savedMap = new Map<string, { x: number, y: number, w: number, h: number }>();

        for (const video of list.items) {
            items.push({
                i: video.id,
                x: video.position.x,
                y: video.position.y,
                w: video.position.w,
                h: video.position.h,
            });

            leaseMap.set(video.id, video.lease);
            savedMap.set(video.id, { ...video.position });
        }

        layout.value = items;
        leases.value = leaseMap;
        saved.value = savedMap;

        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

/**
 * Persist changed grid placements - debounced as drag operations can push
 * a burst of layout updates as other items reflow around the moved item
 */
function saveLayout(updated: Layout): void {
    if (saveTimeout.value) {
        window.clearTimeout(saveTimeout.value);
    }

    saveTimeout.value = window.setTimeout(async () => {
        for (const item of updated) {
            const id = String(item.i);
            const prev = saved.value.get(id);

            if (!prev) continue;

            const position = { x: item.x, y: item.y, w: item.w, h: item.h };

            if (
                prev.x === position.x && prev.y === position.y
                && prev.w === position.w && prev.h === position.h
            ) continue;

            try {
                await std(`/api/profile/video/${id}`, {
                    method: 'PATCH',
                    body: { position }
                });

                saved.value.set(id, position);
            } catch (err) {
                console.error('Failed to save Video Wall layout:', err);
            }
        }
    }, 500);
}

async function removeVideo(id: string): Promise<void> {
    try {
        await std(`/api/profile/video/${id}`, {
            method: 'DELETE'
        });

        layout.value = layout.value.filter((item) => String(item.i) !== id);
        leases.value.delete(id);
        names.delete(id);
        saved.value.delete(id);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

<style>
.video-wall .cloudtak-logo {
    height: 32px;
    width: 32px;
}

.video-wall .cursor-move {
    cursor: move;
}

.video-wall .vgl-item--placeholder {
    background: rgba(0, 132, 255, 0.3);
    border-radius: 4px;
}

.video-wall .vgl-item__resizer {
    z-index: 20;
}
</style>
