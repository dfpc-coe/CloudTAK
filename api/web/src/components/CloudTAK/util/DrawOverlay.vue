<template>
    <div
        class='position-absolute bottom-0 text-white bg-dark rounded-top'
        style='
            z-index: 1;
            left: calc(50% - 250px);
            width: 500px;
        '
    >
        <div
            v-if='mapStore.draw.mode === DrawToolMode.POINT'
            class='card user-select-none'
        >
            <div class='card-header'>
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
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.CIRCLE'
            class='card user-select-none'
        >
            <div class='card-header'>
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
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.RECTANGLE'
            class='card user-select-none'
        >
            <div class='card-header'>
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
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.LINESTRING'
            class='card user-select-none'
        >
            <div class='card-header'>
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
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.POLYGON'
            class='card user-select-none'
        >
            <div class='card-header'>
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
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.SECTOR'
            class='card user-select-none'
        >
            <div class='card-header'>
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
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.FREEHAND'
            class='card user-select-none'
        >
            <div class='card-header'>
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
                v-if='opened'
                class='card-body'
            >
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
            class='card user-select-none'
        >
            <div class='card-header'>
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
