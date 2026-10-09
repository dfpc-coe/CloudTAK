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
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import type { Component } from 'vue';
import { DrawToolMode } from '../../stores/modules/draw.ts';
import CoordInput from './Inputs/CoordInput.vue';
import RangeRingsInput from './Inputs/RangeRingsInput.vue';
import RangeInput from './Inputs/RangeInput.vue';
import GeoJSONInput from './Inputs/GeoJSONInput.vue';
import QuickPicInput from './Inputs/QuickPicInput.vue';
import CreateCoreEntity from './util/CreateCoreEntity.vue';
import {
    IconCamera,
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
    IconCalendarEvent,
    IconCompass,
    IconCursorText,
    IconPencilPlus,
} from '@tabler/icons-vue';
import { useMapStore } from '../../stores/map';
import { useFloatStore } from '../../stores/float.ts';
import {
    TablerNone,
    TablerInput,
    TablerIconButton,
    TablerDropdown,
} from '@tak-ps/vue-tabler';

const mapStore = useMapStore();
const floatStore = useFloatStore();

const search = ref<string>('');
const searchVisible = ref<boolean>(false);

type DrawToolItem = {
    key: string;
    label: string;
    icon: Component;
    action: () => void;
};

const drawTools: DrawToolItem[] = [
    { key: 'coordinate', label: 'Coordinate Input', icon: IconCursorText, action: () => { openPane('coordinate-input', 'Coordinate Entry', CoordInput, 420); } },
    { key: 'event', label: 'Create Event', icon: IconCalendarEvent, action: () => { openPane('create-event', 'Create Event', CreateCoreEntity, 640, 600); } },
    { key: 'quick_pic', label: 'Quick Pic', icon: IconCamera, action: () => { openPane('quick-pic', 'Quick Pic', QuickPicInput, 300); } },
    { key: 'range', label: 'Range & Bearing', icon: IconCompass, action: () => { openPane('range-bearing-input', 'Range & Bearing', RangeInput, 560); } },
    { key: 'range_rings', label: 'Range Rings', icon: IconTarget, action: () => { openPane('range-rings-input', 'Range Rings', RangeRingsInput, 640); } },
    { key: 'point', label: 'Draw Point', icon: IconPoint, action: () => { mapStore.draw.start(DrawToolMode.POINT); } },
    { key: 'line', label: 'Draw Line', icon: IconLine, action: () => { mapStore.draw.start(DrawToolMode.LINESTRING); } },
    { key: 'polygon', label: 'Draw Polygon', icon: IconPolygon, action: () => { mapStore.draw.start(DrawToolMode.POLYGON); } },
    { key: 'rectangle', label: 'Draw Rectangle', icon: IconVector, action: () => { mapStore.draw.start(DrawToolMode.RECTANGLE); } },
    { key: 'circle', label: 'Draw Circle', icon: IconCircle, action: () => { mapStore.draw.start(DrawToolMode.CIRCLE); } },
    { key: 'sector', label: 'Draw Sector', icon: IconCone, action: () => { mapStore.draw.start(DrawToolMode.SECTOR); } },
    { key: 'lasso', label: 'Lasso Select', icon: IconLasso, action: () => { mapStore.draw.start(DrawToolMode.FREEHAND); } },
    { key: 'import', label: 'GeoJSON Import', icon: IconFileImport, action: () => { openPane('geojson-import', 'GeoJSON Import', GeoJSONInput, 500, 500); } },
];

const filteredDrawTools = computed<DrawToolItem[]>(() => {
    const query = search.value.trim().toLowerCase();
    if (!query) return drawTools;
    return drawTools.filter((tool) => tool.label.toLowerCase().includes(query));
});

function openPane(uid: string, name: string, component: Component, height: number, width = 400): void {
    if (floatStore.panes.has(uid)) return;
    floatStore.add({ uid, name, component, height, width, corner: 'top-right' });
}

function toggleSearch(): void {
    searchVisible.value = !searchVisible.value;
    if (!searchVisible.value) search.value = '';
}
</script>
