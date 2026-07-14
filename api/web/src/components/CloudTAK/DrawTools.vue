<template>
    <TablerDropdown>
        <template #default>
            <TablerIconButton
                title='Geometry Editing'
                class='mx-2 cloudtak-hover'
                :hover='false'
            >
                <IconPencilPlus
                    :size='40'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #dropdown>
            <div
                style='min-width: 300px;'
            >
                <div class='d-flex align-items-center px-3 py-2 border-bottom'>
                    <h3 class='m-0 fw-bold'>
                        Drawing Tools
                    </h3>
                    <div class='ms-auto btn-list'>
                        <TablerIconButton
                            title='Search Tools'
                            @click.stop='toggleSearch'
                        >
                            <IconSearch
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>
                <div
                    v-if='searchVisible'
                    class='px-3 py-2'
                >
                    <TablerInput
                        v-model='search'
                        placeholder='Search...'
                        icon='search'
                        :autofocus='true'
                        class='mb-0'
                        @click.stop
                    />
                </div>
                <div class='px-2 py-2'>
                    <div
                        v-for='tool in filteredDrawTools'
                        :key='tool.key'
                        class='col-12 py-1 px-2 cloudtak-hover cursor-pointer user-select-none'
                        @click='tool.action()'
                    >
                        <component
                            :is='tool.icon'
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>{{ tool.label }}</span>
                    </div>
                    <TablerNone
                        v-if='!filteredDrawTools.length'
                        :compact='true'
                        :create='false'
                        label='No Tools'
                    />
                </div>
            </div>
        </template>
    </TablerDropdown>

    <CoordInput
        v-if='modal === ModalInputType.POINT'
        @close='modal = ModalInputType.NONE'
    />

    <RangeRingsInput
        v-if='modal === ModalInputType.RANGE_RINGS'
        @close='modal = ModalInputType.NONE'
    />

    <RangeInput
        v-if='modal === ModalInputType.RANGE'
        @close='modal = ModalInputType.NONE'
    />

    <GeoJSONInput
        v-if='modal === ModalInputType.IMPORT'
        @close='modal = ModalInputType.NONE'
    />
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import type { Component } from 'vue';
import { DrawToolMode } from '../../stores/modules/draw.ts';
import CoordInput from './Inputs/CoordInput.vue';
import RangeRingsInput from './Inputs/RangeRingsInput.vue';
import RangeInput from './Inputs/RangeInput.vue';
import GeoJSONInput from './Inputs/GeoJSONInput.vue';
import {
    IconTarget,
    IconLasso,
    IconSearch,
    IconFileImport,
    IconCone,
    IconCircle,
    IconVector,
    IconPolygon,
    IconLine,
    IconPoint,
    IconCompass,
    IconCursorText,
    IconPencilPlus,
} from '@tabler/icons-vue';
import { useMapStore } from '../../stores/map';
import {
    TablerNone,
    TablerInput,
    TablerIconButton,
    TablerDropdown,
} from '@tak-ps/vue-tabler';

enum ModalInputType {
    NONE = 'none',
    RANGE = 'range',
    POINT = 'point',
    IMPORT = 'import',
    RANGE_RINGS = 'range_rings',
}

const modal = ref<ModalInputType>(ModalInputType.NONE);

const mapStore = useMapStore();

const search = ref<string>('');
const searchVisible = ref<boolean>(false);

type DrawToolItem = {
    key: string;
    label: string;
    icon: Component;
    action: () => void;
};

const drawTools: DrawToolItem[] = [
    { key: 'coordinate', label: 'Coordinate Input', icon: IconCursorText, action: () => { modal.value = ModalInputType.POINT; } },
    { key: 'range', label: 'Range & Bearing', icon: IconCompass, action: () => { modal.value = ModalInputType.RANGE; } },
    { key: 'range_rings', label: 'Range Rings', icon: IconTarget, action: () => { modal.value = ModalInputType.RANGE_RINGS; } },
    { key: 'point', label: 'Draw Point', icon: IconPoint, action: () => { mapStore.draw.start(DrawToolMode.POINT); } },
    { key: 'line', label: 'Draw Line', icon: IconLine, action: () => { mapStore.draw.start(DrawToolMode.LINESTRING); } },
    { key: 'polygon', label: 'Draw Polygon', icon: IconPolygon, action: () => { mapStore.draw.start(DrawToolMode.POLYGON); } },
    { key: 'rectangle', label: 'Draw Rectangle', icon: IconVector, action: () => { mapStore.draw.start(DrawToolMode.RECTANGLE); } },
    { key: 'circle', label: 'Draw Circle', icon: IconCircle, action: () => { mapStore.draw.start(DrawToolMode.CIRCLE); } },
    { key: 'sector', label: 'Draw Sector', icon: IconCone, action: () => { mapStore.draw.start(DrawToolMode.SECTOR); } },
    { key: 'lasso', label: 'Lasso Select', icon: IconLasso, action: () => { mapStore.draw.start(DrawToolMode.FREEHAND); } },
    { key: 'import', label: 'GeoJSON Import', icon: IconFileImport, action: () => { modal.value = ModalInputType.IMPORT; } },
];

const filteredDrawTools = computed<DrawToolItem[]>(() => {
    const query = search.value.trim().toLowerCase();
    if (!query) return drawTools;
    return drawTools.filter((tool) => tool.label.toLowerCase().includes(query));
});

function toggleSearch(): void {
    searchVisible.value = !searchVisible.value;
    if (!searchVisible.value) search.value = '';
}
</script>
