<template>
    <GenericBottomPane>
        <div
            v-if='mapStore.draw.mode === DrawToolMode.POINT'
            class='card user-select-none'
        >
            <div class='card-header'>
                <template v-if='!mapStore.isMobileDetected'>
                    <CoordinateType
                        v-model='mapStore.draw.point.type'
                    />
                </template>
                <template v-else>
                    <IconPoint
                        :size='24'
                        stroke='1'
                    /><span class='mx-2'>Draw Point</span>
                </template>

                <div class='ms-auto btn-list'>
                    <TablerIconButton
                        v-if='mapStore.isMobileDetected'
                        :title='opened ? "Close Settings" : "Open Settings"'
                        @click='opened = !opened'
                    >
                        <span class='d-flex align-items-center'>
                            <span>More</span>
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
                        </span>
                    </TablerIconButton>
                    <TablerIconButton
                        title='Finish Drawing'
                        :disabled='!mapStore.draw.canFinish'
                        @click='mapStore.draw.finish()'
                    >
                        <IconCheck
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
                v-if='mapStore.isMobileDetected && opened'
                class='card-body'
            >
                <CoordinateType
                    v-model='mapStore.draw.point.type'
                />
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
                        title='Finish Drawing'
                        :disabled='!mapStore.draw.canFinish'
                        @click='mapStore.draw.finish()'
                    >
                        <IconCheck
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
                        title='Finish Drawing'
                        :disabled='!mapStore.draw.canFinish'
                        @click='mapStore.draw.finish()'
                    >
                        <IconCheck
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
        </div>
        <div
            v-else-if='mapStore.draw.mode === DrawToolMode.LINESTRING || mapStore.draw.mode === DrawToolMode.SNAPPING'
            class='card user-select-none'
        >
            <div class='card-header'>
                <IconLine
                    :size='24'
                    stroke='1'
                /><span class='mx-2'>Line Editing</span>

                <div class='ms-auto btn-list align-items-center'>
                    <TablerEnum
                        v-if='!mapStore.isMobileDetected'
                        v-model='mapStore.draw.snappingLayer'
                        description='Choose the type of line to draw.'
                        default='No Snapping'
                        :options='mapStore.draw.snappingOptions'
                        :disabled='!mapStore.hasSnapping'
                    />

                    <TablerIconButton
                        v-if='mapStore.isMobileDetected'
                        :title='opened ? "Close Settings" : "Open Settings"'
                        @click='opened = !opened'
                    >
                        <span class='d-flex align-items-center'>
                            <span>More</span>
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
                        </span>
                    </TablerIconButton>

                    <TablerIconButton
                        title='Finish Drawing'
                        :disabled='!mapStore.draw.canFinish'
                        @click='mapStore.draw.finish()'
                    >
                        <IconCheck
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
                v-if='mapStore.isMobileDetected && opened'
                class='card-body'
            >
                <TablerEnum
                    v-model='mapStore.draw.snappingLayer'
                    description='Choose the type of line to draw.'
                    default='No Snapping'
                    :options='mapStore.draw.snappingOptions'
                    :disabled='!mapStore.hasSnapping'
                />
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
                        title='Finish Drawing'
                        :disabled='!mapStore.draw.canFinish'
                        @click='mapStore.draw.finish()'
                    >
                        <IconCheck
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
                        title='Finish Drawing'
                        :disabled='!mapStore.draw.canFinish'
                        @click='mapStore.draw.finish()'
                    >
                        <IconCheck
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
                        v-if='mapStore.isMobileDetected'
                        :title='opened ? "Close Settings" : "Open Settings"'
                        @click='opened = !opened'
                    >
                        <span class='d-flex align-items-center'>
                            <span>More</span>
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
                        </span>
                    </TablerIconButton>

                    <TablerIconButton
                        title='Finish Drawing'
                        :disabled='!mapStore.draw.canFinish'
                        @click='mapStore.draw.finish()'
                    >
                        <IconCheck
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
                v-if='!mapStore.isMobileDetected || opened'
                class='card-body'
            >
                <TablerEnum
                    v-model='mapStore.draw.lasso.overlay'
                    label='Layer Selection'
                    description='Features will be selected from the chosen layer.'
                    default='CoT Icons'
                    :options='filteredOverlayNames'
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
                        title='Finish Drawing'
                        :disabled='!mapStore.draw.canFinish'
                        @click='mapStore.draw.finish()'
                    >
                        <IconCheck
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
        </div>
    </GenericBottomPane>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, watch } from 'vue';
import GenericBottomPane from '../GenericBottomPane.vue';
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
    IconPoint,
    IconPencil,
    IconChevronUp,
    IconChevronDown,
    IconCircle,
    IconLasso,
    IconCone,
    IconVector,
    IconPolygon,
    IconCheck,
} from '@tabler/icons-vue';

const mapStore = useMapStore();

const opened = ref(false);

const filteredOverlayNames = computed((): string[] => {
    type O = { id: number; actions: { feature: string[] }; name: string };
    return (mapStore.overlays as unknown as O[])
        .filter(o => o.actions.feature.includes('query') || o.id === -1)
        .map(o => o.name);
});

onMounted(async () => {
    if (mapStore.hasSnapping && (mapStore.draw.mode === DrawToolMode.LINESTRING || mapStore.draw.mode === DrawToolMode.SNAPPING)) {
        await mapStore.draw.populateSnappingLayers();
    }
});

watch([() => mapStore.draw.mode, () => mapStore.hasSnapping], async () => {
    if (mapStore.hasSnapping && (mapStore.draw.mode === DrawToolMode.LINESTRING || mapStore.draw.mode === DrawToolMode.SNAPPING)) {
        await mapStore.draw.populateSnappingLayers();
    }
});
</script>
