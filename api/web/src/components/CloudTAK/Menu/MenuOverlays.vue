<template>
    <MenuTemplate name='Overlays'>
        <template #buttons>
            <TablerIconButton
                v-if='isDraggable === false'
                title='Edit Order'
                @click='isDraggable = true'
            >
                <IconPencil
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-else-if='isDraggable === true'
                title='Save Order'
                @click='isDraggable = false'
            >
                <IconPencilCheck
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='!isDraggable'
                title='Add Overlay'
                @click='router.push("/menu/datas")'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <TablerLoading v-if='loading || !isLoaded' />
            <template v-else>
                <div ref='sortableRef'>
                    <div
                        v-for='overlay in overlays'
                        :id='String(overlay.id)'
                        :key='overlay.id'
                        class='col-lg py-2'
                    >
                        <div class='py-2 px-3'>
                            <div class='col-12 d-flex align-items-center'>
                                <IconGripVertical
                                    v-if='isDraggable'
                                    v-tooltip='"Draw to reorder"'
                                    class='drag-handle cursor-move'
                                    role='button'
                                    tabindex='0'
                                    :size='20'
                                    stroke='1'
                                />

                                <template v-if='!overlay.healthy()'>
                                    <IconAlertTriangle
                                        v-if='!isDraggable && !opened.has(overlay.id)'
                                        v-tooltip='overlay._error ? overlay._error.message : "Unknown Error"'
                                        :size='20'
                                        stroke='1'
                                    />
                                </template>
                                <template v-else-if='overlay.id !== 0'>
                                    <TablerIconButton
                                        v-if='!isDraggable && !opened.has(overlay.id)'
                                        title='Expand Options'
                                        @click='opened.add(overlay.id)'
                                    >
                                        <IconChevronRight
                                            :size='20'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                    <TablerIconButton
                                        v-else-if='!isDraggable'
                                        title='Collapse Options'
                                        @click='opened.delete(overlay.id)'
                                    >
                                        <IconChevronDown
                                            :size='20'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </template>

                                <span class='mx-2'>
                                    <IconMap
                                        v-if='overlay.type === "raster"'
                                        v-tooltip='"Raster"'
                                        :size='20'
                                        stroke='1'
                                    />
                                    <IconAmbulance
                                        v-else-if='overlay.type === "geojson" && overlay.mode === "mission"'
                                        v-tooltip='"Data Sync"'
                                        :size='20'
                                        stroke='1'
                                    />
                                    <IconVector
                                        v-else
                                        v-tooltip='"Vector"'
                                        :size='20'
                                        stroke='1'
                                    />
                                </span>

                                <span
                                    class='mx-2 user-select-none text-truncate'
                                    style='width: 200px;'
                                >
                                    <a
                                        v-if='overlay.mode === "mission"'
                                        class='cursor-pointer text-underline'
                                        @click='router.push(`/menu/missions/${overlay.mode_id}`)'
                                        v-text='overlay.name'
                                    />
                                    <span
                                        v-else
                                        v-text='overlay.name'
                                    />
                                </span>

                                <div class='ms-auto btn-list'>
                                    <TablerIconButton
                                        v-if='overlay.hasBounds()'
                                        title='Zoom To Overlay'
                                        @click.stop.prevent='overlay.zoomTo()'
                                    >
                                        <IconMaximize
                                            :size='20'
                                            stroke='1'
                                        />
                                    </TablerIconButton>

                                    <TablerDelete
                                        v-if='
                                            opened.has(overlay.id)
                                                && ["mission", "data", "profile", "overlay"].includes(overlay.mode)
                                        '
                                        :key='overlay.id'
                                        v-tooltip='"Delete Overlay"'
                                        :size='20'
                                        role='button'
                                        tabindex='0'
                                        displaytype='icon'
                                        @delete='removeOverlay(overlay.id)'
                                    />

                                    <TablerIconButton
                                        v-if='overlay.visible'
                                        title='Hide Layer'
                                        @click.stop.prevent='overlay.update({ visible: !overlay.visible })'
                                    >
                                        <IconEye
                                            :size='20'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                    <TablerIconButton
                                        v-else
                                        title='Show Layer'
                                        @click.stop.prevent='overlay.update({ visible: !overlay.visible })'
                                    >
                                        <IconEyeOff
                                            :size='20'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                </div>
                            </div>
                        </div>

                        <template v-if='!isDraggable && opened.has(overlay.id)'>
                            <div
                                v-if='overlay.type === "raster"'
                                class='col-12'
                                style='margin-left: 30px; padding-right: 40px;'
                            >
                                <TablerRange
                                    v-model='overlay.opacity'
                                    label='Opacity'
                                    :min='0'
                                    :max='1'
                                    :step='0.1'
                                    @change='overlay.update({
                                        opacity: overlay.opacity
                                    })'
                                />
                            </div>
                            <TreeCots
                                v-if='overlay.type === "geojson" && overlay.id === -1'
                                :element='overlay'
                            />
                            <TreeMission
                                v-if='overlay.mode === "mission"'
                                :overlay='overlay'
                            />
                            <TreeVector
                                v-if='overlay.type === "vector"'
                                :overlay='overlay'
                            />
                        </template>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerDelete,
    TablerIconButton,
    TablerLoading,
    TablerRange
} from '@tak-ps/vue-tabler';
import TreeCots from './Overlays/TreeCots.vue';
import TreeVector from './Overlays/TreeVector.vue';
import TreeMission from './Overlays/TreeMission.vue';
import {
    IconGripVertical,
    IconAlertTriangle,
    IconChevronRight,
    IconChevronDown,
    IconAmbulance,
    IconMaximize,
    IconVector,
    IconEyeOff,
    IconPencil,
    IconPencilCheck,
    IconPlus,
    IconEye,
    IconMap
} from '@tabler/icons-vue';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs'
import { useMapStore } from '../../../../src/stores/map.ts';

const mapStore = useMapStore();
const router = useRouter();

let sortable: Sortable;

const isDraggable = ref(false);
const loading = ref(false);
const opened = ref<Set<number>>(new Set());

const isLoaded = mapStore.isLoaded;
const overlays = mapStore.overlays;

const sortableRef = useTemplateRef<HTMLElement>('sortableRef');

watch(isDraggable, () => {
    if (isDraggable.value && sortableRef.value) {
        sortable = new Sortable(sortableRef.value, {
            sort: true,
            handle: '.drag-handle',
            dataIdAttr: 'id',
            onEnd: saveOrder
        })
    } else {
        sortable.destroy()
    }
});

async function saveOrder(sortableEv: SortableEvent) {
    if (sortableEv.newIndex === undefined || isNaN(parseInt(String(sortableEv.newIndex)))) return;

    const id = sortableEv.item.getAttribute('id');
    if (!id) return;

    // TODO: Eventually it would be awesome to just move the Overlay in the overlays array
    // And the MapStore would just dynamically re-order the layers so any part of the app could reorder

    const overlay_ids = sortable.toArray().map((i) => {
        return parseInt(i)
    });

    const overlay = mapStore.getOverlayById(parseInt(id))
    if (!overlay) throw new Error(`Could not find Overlay`);

    const post = mapStore.getOverlayById(overlay_ids[sortableEv.newIndex + 1]);

    for (const l of overlay.styles) {
        if (post) {
            mapStore.map.moveLayer(l.id, post.styles[0].id)
        } else {
            mapStore.map.moveLayer(l.id)
        }
    }

    for (const overlay of overlays) {
        await overlay.update({
            pos: overlay_ids.indexOf(overlay.id)
        });
    }
}

async function removeOverlay(id: number) {
    loading.value = true;
    for (const overlay of overlays) {
        if (overlay.id === id) {
            await mapStore.removeOverlay(overlay);
        }
    }
    loading.value = false;
}
</script>
