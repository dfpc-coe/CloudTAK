<template>
    <StandardItem class='px-3 py-2'>
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
                            :title='overlayButtonTitle(asset)'
                            :disabled='!canCreateOverlay(asset)'
                            @click.stop.prevent='canCreateOverlay(asset) && emit("create-overlay", asset)'
                        >
                            <IconMapPlus
                                v-if='assetSupportsOverlay(asset)'
                                :size='32'
                                stroke='1'
                            />
                            <IconMapOff
                                v-else
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                    <div class='flex-grow-1 min-width-0 overflow-hidden'>
                        <div
                            class='col-12 px-2 user-select-none overflow-hidden'
                        >
                            <span
                                class='d-block text-truncate'
                                :title='asset.name'
                                v-text='asset.name'
                            />
                        </div>
                        <div class='col-12 subheader d-flex align-items-center gap-2 px-2 min-width-0'>
                            <span class='mx-2 user-select-none'>
                                <TablerBytes :bytes='asset.size' /> - <TablerEpoch :date='asset.updated' />
                            </span>
                            <button
                                v-if='Array.isArray(asset.channels) && asset.channels.length > 0'
                                type='button'
                                class='menu-files-row__shared-badge-btn ms-auto flex-shrink-0 p-0 border-0 bg-transparent'
                                title='Share to Channel'
                                @click.stop.prevent='emit("share-channel", asset)'
                            >
                                <TablerBadge
                                    class='small menu-files-row__shared-badge'
                                    background-color='rgba(36, 163, 255, 0.15)'
                                    border-color='rgba(36, 163, 255, 0.35)'
                                    text-color='#24a3ff'
                                >
                                    Shared
                                </TablerBadge>
                            </button>
                        </div>
                    </div>
                </div>
            </template>
            <template #expanded>
                <div
                    v-if='assetSupportsOverlay(asset)'
                    :class='[
                        "rounded col-12 d-flex align-items-center px-2 py-2 user-select-none",
                        canCreateOverlay(asset) ? "cursor-pointer cloudtak-hover" : "opacity-50 pe-none"
                    ]'
                    role='menuitem'
                    :tabindex='canCreateOverlay(asset) ? 0 : -1'
                    :aria-disabled='!canCreateOverlay(asset)'
                    @click.stop.prevent='canCreateOverlay(asset) && emit("create-overlay", asset)'
                    @keyup.enter='canCreateOverlay(asset) && emit("create-overlay", asset)'
                >
                    <IconMapPlus
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>{{ canCreateOverlay(asset) ? "Add to Map as Overlay" : "Overlay already added" }}</span>
                </div>
                <div
                    v-else
                    role='menuitem'
                    class='rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                >
                    <IconMapOff
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>Cannot Add to Map - Unsupported Format</span>
                </div>

                <div
                    class='cursor-pointer rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                    @click.stop.prevent='emit("download", asset)'
                >
                    <IconDownload
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>Download Original</span>
                </div>
                <div
                    class='cursor-pointer rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                    role='menuitem'
                    tabindex='0'
                    @click.stop.prevent='emit("share-mission", asset)'
                    @keyup.enter='emit("share-mission", asset)'
                >
                    <IconAmbulance
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>Add to Data Sync</span>
                </div>
                <div
                    class='cursor-pointer rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                    role='menuitem'
                    tabindex='0'
                    @click.stop.prevent='emit("share-package", asset)'
                    @keyup.enter='emit("share-package", asset)'
                >
                    <IconPackage
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>Create Data Package</span>
                </div>
                <div
                    class='cursor-pointer rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                    role='menuitem'
                    tabindex='0'
                    @click.stop.prevent='emit("share-channel", asset)'
                    @keyup.enter='emit("share-channel", asset)'
                >
                    <IconBroadcast
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>Share to Channel</span>
                </div>

                <div
                    class='cursor-pointer rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                    role='menuitem'
                    tabindex='0'
                    @click.stop.prevent='emit("rename", asset)'
                    @keyup.enter='emit("rename", asset)'
                >
                    <IconCursorText
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>Rename File</span>
                </div>

                <div v-if='rename && rename.id === asset.id'>
                    <TablerInput
                        :model-value='rename.name'
                        class='m-2'
                        :placeholder='asset.name'
                        :autofocus='true'
                        @update:model-value='emit("rename-change", String($event || ""))'
                        @blur='emit("rename-cancel")'
                        @keyup.enter='emit("rename-submit")'
                    />
                </div>

                <div
                    class='cursor-pointer rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                    role='menuitem'
                    tabindex='0'
                    @click.stop.prevent='emit("move", asset)'
                    @keyup.enter='emit("move", asset)'
                >
                    <IconFolderSymlink
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>Move to Folder</span>
                </div>

                <TablerDelete
                    displaytype='menu'
                    class='cloudtak-hover rounded'
                    label='Delete File'
                    @delete='emit("delete", asset)'
                />
            </template>
        </TablerSlidedown>
    </StandardItem>
</template>

<script setup lang='ts'>
import type { ProfileFile } from '../../../types.ts';
import StandardItem from '../util/StandardItem.vue';
import {
    TablerDelete,
    TablerSlidedown,
    TablerBadge,
    TablerIconButton,
    TablerInput,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';
import {
    IconAmbulance,
    IconPackage,
    IconMapOff,
    IconMapPlus,
    IconDownload,
    IconCursorText,
    IconFolderSymlink,
    IconBroadcast
} from '@tabler/icons-vue';

const props = defineProps<{
    asset: ProfileFile;
    overlayUrls: Set<string>;
    rename?: {
        id: string;
        loading: boolean;
        name: string;
    };
}>();

const emit = defineEmits<{
    'create-overlay': [asset: ProfileFile];
    'download': [asset: ProfileFile];
    'share-mission': [asset: ProfileFile];
    'share-package': [asset: ProfileFile];
    'share-channel': [asset: ProfileFile];
    'rename': [asset: ProfileFile];
    'rename-change': [name: string];
    'rename-submit': [];
    'rename-cancel': [];
    'delete': [asset: ProfileFile];
    'move': [asset: ProfileFile];
}>();

function assetOverlayExists(asset: ProfileFile): boolean {
    const url = `/api/profile/asset/${encodeURIComponent(asset.id)}.pmtiles/tile`;
    return props.overlayUrls.has(url);
}

function assetSupportsOverlay(asset: ProfileFile): boolean {
    return asset.artifacts.some((artifact) => artifact.ext === '.pmtiles');
}

function canCreateOverlay(asset: ProfileFile): boolean {
    return assetSupportsOverlay(asset) && !assetOverlayExists(asset);
}

function overlayButtonTitle(asset: ProfileFile): string {
    if (!assetSupportsOverlay(asset)) return 'Not Cloud Optimized';
    if (assetOverlayExists(asset)) return 'Overlay already added';
    return 'Add to Map as Overlay';
}
</script>

<style scoped>
.menu-files-row__shared-badge-btn {
    line-height: 0;
}

.menu-files-row__shared-badge-btn :deep(.menu-files-row__shared-badge) {
    transition: transform 0.15s ease, filter 0.15s ease;
}

.menu-files-row__shared-badge-btn:hover :deep(.menu-files-row__shared-badge),
.menu-files-row__shared-badge-btn:focus-visible :deep(.menu-files-row__shared-badge) {
    filter: brightness(1.15);
    transform: translateY(-1px);
}

.menu-files-row__shared-badge-btn:focus-visible {
    outline: 2px solid rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.7);
    outline-offset: 2px;
    border-radius: 999px;
}
</style>
