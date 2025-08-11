<template>
    <div
        class='position-absolute bottom-0 text-white bg-dark px-2 py-2 rounded-top'
        style='
            z-index: 1;
            left: calc(50% - 120px);
            width: 300px;
        '
    >
        <div
            v-if='mapStore.draw.mode === DrawToolMode.POINT'
            class='d-flex align-items-center'
        >
            <CoordinateType
                v-model='mapStore.draw.point.type'
            />

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Cancel Editing'
                    @click='mapStore.draw.stop()'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.CIRCLE'
            class='d-flex align-items-center user-select-none'
        >
            <IconCircle
                :size='24'
                stroke='1'
            />
            <span class='mx-2'>Circle Editing</span>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Cancel Editing'
                    @click='mapStore.draw.stop()'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.RECTANGLE'
            class='d-flex align-items-center user-select-none'
        >
            <IconVector
                :size='24'
                stroke='1'
            /><span class='mx-2'>Rectangle Editing</span>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Cancel Editing'
                    @click='mapStore.draw.stop()'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.LINESTRING'
            class='d-flex align-items-center user-select-none'
        >
            <IconLine
                :size='24'
                stroke='1'
            /><span class='mx-2'>Line Editing</span>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Cancel Editing'
                    @click='mapStore.draw.stop()'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.POLYGON'
            class='d-flex align-items-center user-select-none'
        >
            <IconPolygon
                :size='24'
                stroke='1'
            /><span class='mx-2'>Polygon Editing</span>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Cancel Editing'
                    @click='mapStore.draw.stop()'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.SECTOR'
            class='d-flex align-items-center user-select-none'
        >
            <IconCone
                :size='24'
                stroke='1'
            /><span class='mx-2'>Sector Editing</span>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Cancel Editing'
                    @click='mapStore.draw.stop()'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.FREEHAND'
            class='user-select-none'
        >
            <div class='col-12 d-flex align-items-center'>
                <IconLasso
                    :size='24'
                    stroke='1'
                /><span class='mx-2'>Lasso Select</span>

                <div class='ms-auto btn-list'>
                    <TablerIconButton
                        :title='opened ? "Open Settings" : "Close Settings"'
                        @click='opened = !opened'
                    >
                        <IconChevronDown
                            v-if='opened'
                            :size='24'
                            stroke='1'
                        />
                        <IconChevronUp
                            v-else
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        title='Cancel Editing'
                    >
                        <IconX
                            :size='24'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>
            <div v-if='opened' class='col-12 px-2'>
                <TablerEnum
                    label='Layer Selection'
                    description='Features will be selected from the chosen layer.'
                    default='CoT Icons'
                    :options='
                        mapStore.overlays
                            .filter(overlay => overlay.actions.feature.includes("query") || overlay.id === -1)
                            .map(overlay => overlay.name)
                    '
                />
            </div>
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.SELECT'
            class='d-flex align-items-center user-select-none'
        >
            <IconPencil
                :size='24'
                stroke='1'
            /><span class='mx-2'>Editing Existing Feature</span>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Cancel Editing'
                    @click='mapStore.draw.stop()'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import CoordinateType from '../util/CoordinateType.vue';
import { DrawToolMode } from '../../../stores/modules/draw.ts';
import { useMapStore } from '../../../stores/map.ts';
import {
    TablerEnum,
    TablerIconButton
} from '@tak-ps/vue-tabler'
import {
    IconX,
    IconLine,
    IconPencil,
    IconChevronUp,
    IconChevronDown,
    IconCircle,
    IconLasso,
    IconCone,
    IconVector,
    IconPolygon,
} from '@tabler/icons-vue';

const mapStore = useMapStore();

const opened = ref(false);
</script>
