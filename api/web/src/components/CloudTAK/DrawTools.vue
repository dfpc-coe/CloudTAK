<template>
    <TablerDropdown>
        <template #default>
            <TablerIconButton
                title='Geometry Editing'
                class='mx-2 hover-button'
                :hover='false'
            >
                <IconPencil
                    :size='40'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #dropdown>
            <div
                class='card py-1'
                style='min-width: 300px;'
            >
                <div class='card-body'>
                    <div class='card-title'>
                        Drawing Tools
                    </div>
                </div>
                <div class='card-body'>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='modal = ModalInputType.POINT'
                    >
                        <IconCursorText
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Coordinate Input</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='modal = ModalInputType.RANGE'
                    >
                        <IconCompass
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Range &amp; Bearing</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='modal = ModalInputType.RANGE_RINGS'
                    >
                        <IconTarget
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Range Rings</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='mapStore.draw.start(DrawToolMode.POINT)'
                    >
                        <IconPoint
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Draw Point</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='mapStore.draw.start(DrawToolMode.LINESTRING)'
                    >
                        <IconLine
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Draw Line</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='mapStore.draw.start(DrawToolMode.POLYGON)'
                    >
                        <IconPolygon
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Draw Polygon</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='mapStore.draw.start(DrawToolMode.RECTANGLE)'
                    >
                        <IconVector
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Draw Rectangle</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='mapStore.draw.start(DrawToolMode.CIRCLE)'
                    >
                        <IconCircle
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Draw Circle</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='mapStore.draw.start(DrawToolMode.SECTOR)'
                    >
                        <IconCone
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Draw Sector</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='mapStore.draw.start(DrawToolMode.FREEHAND)'
                    >
                        <IconLasso
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>Lasso Select</span>
                    </div>
                    <div
                        class='col-12 py-1 px-2 hover-button cursor-pointer user-select-none'
                        @click='modal = ModalInputType.IMPORT'
                    >
                        <IconFileImport
                            :size='25'
                            stroke='1'
                        />
                        <span class='ps-2'>GeoJSON Import</span>
                    </div>
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
import { ref } from 'vue';
import { DrawToolMode } from '../../stores/modules/draw.ts';
import CoordInput from './CoordInput.vue';
import RangeRingsInput from './RangeRingsInput.vue';
import RangeInput from './RangeInput.vue';
import GeoJSONInput from './GeoJSONInput.vue';
import {
    IconTarget,
    IconLasso,
    IconFileImport,
    IconCone,
    IconCircle,
    IconVector,
    IconPolygon,
    IconLine,
    IconPoint,
    IconCompass,
    IconCursorText,
    IconPencil,
} from '@tabler/icons-vue';
import { useMapStore } from '../../stores/map';
import {
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
</script>
