<template>
    <StandardItem class='px-3 py-2'>
        <TablerSlidedown
            :click-anywhere-expand='true'
            :arrow='false'
            :border='false'
        >
            <template #default>
                <div
                    class='d-flex align-items-center'
                    role='menuitem'
                    tabindex='0'
                >
                    <div class='col-auto'>
                        <IconMapPlus
                            v-if='asset.artifacts.map(a => a.ext).includes(".pmtiles")'
                            :size='32'
                            stroke='1'
                        />
                        <IconMapOff
                            v-else
                            v-tooltip='"Not Cloud Optimized"'
                            :size='32'
                            stroke='1'
                        />
                    </div>
                    <div class='col-auto'>
                        <div
                            class='col-12 text-truncate px-2 user-select-none'
                            style='max-width: 250px;'
                            v-text='asset.name'
                        />
                        <div class='col-12 subheader'>
                            <span class='mx-2 user-select-none'>
                                <TablerBytes :bytes='asset.size' /> - <TablerEpoch :date='asset.updated' />
                            </span>
                        </div>
                    </div>
                </div>
            </template>
            <template #expanded>
                <div
                    v-if='asset.artifacts.map(a => a.ext).includes(".pmtiles")'
                    :class='[
                        "rounded col-12 d-flex align-items-center px-2 py-2 user-select-none",
                        assetOverlayExists(asset) ? "opacity-50 pe-none" : "cursor-pointer cloudtak-hover"
                    ]'
                    role='menuitem'
                    :tabindex='assetOverlayExists(asset) ? -1 : 0'
                    :aria-disabled='assetOverlayExists(asset)'
                    @click.stop.prevent='!assetOverlayExists(asset) && emit("create-overlay", asset)'
                    @keyup.enter='!assetOverlayExists(asset) && emit("create-overlay", asset)'
                >
                    <IconMapPlus
                        :size='32'
                        stroke='1'
                    />
                    <span class='mx-2'>{{ assetOverlayExists(asset) ? "Overlay already added" : "Add to Map as Overlay" }}</span>
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
                        v-model='rename.name'
                        class='m-2'
                        :placeholder='asset.name'
                        :autofocus='true'
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
    IconFolderSymlink
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
    'rename': [asset: ProfileFile];
    'rename-submit': [];
    'rename-cancel': [];
    'delete': [asset: ProfileFile];
    'move': [asset: ProfileFile];
}>();

function assetOverlayExists(asset: ProfileFile): boolean {
    const url = `/api/profile/asset/${encodeURIComponent(asset.id)}.pmtiles/tile`;
    return props.overlayUrls.has(url);
}
</script>
