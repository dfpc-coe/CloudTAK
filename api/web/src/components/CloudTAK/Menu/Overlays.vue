<template>
    <div>
        <OverlayLayers
            v-if='isEditing'
            :overlay='isEditing'
            @close='isEditing = false'
        />

        <MenuTemplate
            v-else
            name='Overlays'
        >
            <template #buttons>
                <IconPencil
                    v-if='isDraggable === false'
                    v-tooltip='"Edit Order"'
                    class='cursor-pointer'
                    :size='32'
                    :stroke='1'
                    @click='isDraggable = true'
                />
                <IconPencilCheck
                    v-else-if='isDraggable === true'
                    v-tooltip='"Save Order"'
                    class='cursor-pointer'
                    :size='32'
                    :stroke='1'
                    @click='isDraggable = false'
                />

                <IconPlus
                    v-if='!isDraggable'
                    v-tooltip='"Add Overlay"'
                    class='cursor-pointer'
                    :size='32'
                    :stroke='1'
                    @click='$router.push("/menu/datas")'
                />
            </template>
            <template #default>
                <TablerLoading v-if='loading' />
                <template v-else>
                    <div ref='sortable'>
                        <div
                            v-for='element in layers'
                            :id='element.id'
                            :key='element.id'
                            class='col-lg py-2'
                        >
                            <div class='py-2 px-3'>
                                <div class='col-12 d-flex align-items-center'>
                                    <IconGripVertical
                                        v-if='isDraggable'
                                        v-tooltip='"Draw to reorder"'
                                        class='drag-handle cursor-move'
                                        :size='32'
                                        :stroke='1'
                                    />

                                    <IconEye
                                        v-if='element.visible === "visible"'
                                        v-tooltip='"Hide Layer"'
                                        :size='32'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click.stop.prevent='flipVisible(element)'
                                    />
                                    <IconEyeOff
                                        v-else
                                        v-tooltip='"Show Layer"'
                                        :size='32'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click.stop.prevent='flipVisible(element)'
                                    />

                                    <span class='mx-2'>
                                        <IconMap
                                            v-if='element.type === "raster"'
                                            v-tooltip='"Raster"'
                                            :size='32'
                                            :stroke='1'
                                        />
                                        <IconVector
                                            v-else
                                            v-tooltip='"Vector"'
                                            :size='32'
                                            :stroke='1'
                                        />
                                    </span>

                                    <span
                                        class='mx-2 user-select-none'
                                        :class='{
                                            "cursor-pointer": ["data", "profile"].includes(element.mode) && element.type === "vector"
                                        }'
                                        @click='editor(element)'
                                        v-text='element.name'
                                    />

                                    <div class='ms-auto btn-list'>
                                        <IconMaximize
                                            v-if='getSource(element).bounds'
                                            v-tooltip='"Zoom To Overlay"'
                                            :size='32'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click.stop.prevent='zoomTo(getSource(element).bounds)'
                                        />
                                        <TablerDelete
                                            v-if='opened.includes(element.id) && (element.mode === "mission" || element.name.startsWith("data-") || element.name.startsWith("profile-"))'
                                            :key='element.id'
                                            v-tooltip='"Delete Overlay"'
                                            displaytype='icon'
                                            @delete='removeLayer(element)'
                                        />
                                    </div>

                                    <IconChevronRight
                                        v-if='!isDraggable && !opened.includes(element.id)'
                                        :size='32'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click='opened.push(element.id)'
                                    />
                                    <IconChevronDown
                                        v-else-if='!isDraggable'
                                        :size='32'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click='opened.splice(opened.indexOf(element.id), 1)'
                                    />
                                </div>
                            </div>

                            <template v-if='!isDraggable'>
                                <div
                                    v-if='element.type === "raster" && opened.includes(element.id)'
                                    class='col-12'
                                    style='margin-left: 30px; padding-right: 40px;'
                                >
                                    <TablerRange
                                        v-model='element.opacity'
                                        label='Opacity'
                                        :min='0'
                                        :max='1'
                                        :step='0.1'
                                        @change='updateOpacity(element)'
                                    />
                                </div>
                                <div v-else-if='element.type === "geojson" && opened.includes(element.id)'>
                                    <TablerLoading v-if='loadingPaths[element.id] === true' />
                                    <template v-else>
                                        <div
                                            v-for='path in paths(element)'
                                            class='d-flex align-items-center hover-dark px-3 py-2'
                                        >
                                            <IconFolder
                                                :size='32'
                                                :stroke='1'
                                                style='margin-left: 40px;'
                                            />
                                            <span
                                                class='mx-2'
                                                v-text='path.path'
                                            />
                                            <div
                                                v-if='element.id === "cots"'
                                                class='ms-auto'
                                            >
                                                <TablerDelete
                                                    displaytype='icon'
                                                    @click='deletePath(element, path.path)'
                                                />
                                            </div>
                                        </div>
                                    </template>
                                </div>
                            </template>
                        </div>
                    </div>
                </template>
            </template>
        </MenuTemplate>
    </div>
</template>

<script>
import MenuTemplate from '../util/MenuTemplate.vue';
import OverlayLayers from './Overlays/Layers.vue';
import {
    TablerDelete,
    TablerLoading,
    TablerRange
} from '@tak-ps/vue-tabler';
import {
    IconGripVertical,
    IconChevronRight,
    IconChevronDown,
    IconMaximize,
    IconVector,
    IconFolder,
    IconEyeOff,
    IconPencil,
    IconPencilCheck,
    IconPlus,
    IconEye,
    IconMap
} from '@tabler/icons-vue';
import Sortable from 'sortablejs';
import { mapState } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();
import { useOverlayStore } from '/src/stores/overlays.ts';
const overlayStore = useOverlayStore();

let sortable;

export default {
    name: 'CloudTAKOverlays',
    data: function() {
        return {
            err: false,
            isDraggable: false,
            isEditing: false,
            loading: false,
            opened: [],
            loadingPaths: {}
        }
    },
    computed: {
        ...mapState(useMapStore, ['layers'])
    },
    watch: {
        isDraggable: function() {
            if (this.isDraggable) {
                sortable = new Sortable(this.$refs.sortable, {
                    sort: true,
                    handle: '.drag-handle',
                    dataIdAttr: 'id',
                    onEnd: this.saveOrder
                })
            } else {
                sortable.destroy()
            }
        }
    },
    methods: {
        saveOrder: async function(sortableEv) {
            const layer_ids = sortable.toArray()

            const layer = mapStore.getLayer(sortableEv.item.getAttribute('id'))

            if (sortableEv.newIndex === layer_ids.length - 1) {
                for (const l of layer.layers) {
                    mapStore.map.moveLayer(l.id)
                }
            } else {
                const post = mapStore.getLayer(layer_ids[sortableEv.newIndex + 1]);
                const postID = post.layers[post.layers.length - 1].id;

                for (const l of layer.layers) {
                    mapStore.map.moveLayer(l.id, postID)
                }
            }

            for (const l of this.layers) {
                if (!l.overlay) continue;
                const pos = layer_ids.indexOf(l.id);

                await overlayStore.updateOverlay(l.overlay, { pos })
            }
        },
        removeLayer: async function(layer) {
            this.loading = true;
            await mapStore.removeLayer(layer.name);
            this.loading = false;
        },
        editor: function(overlay) {
            if (["data", "profile"].includes(overlay.mode) && overlay.type === "vector") {
                this.isEditing = overlay;
            }
        },
        deletePath: async function(layer, path) {
            if (layer.id !== 'cots') return;

            this.loadingPaths[layer.id] = true;

            try {
                await cotStore.deletePath(path);
            } catch (err) {
                this.loadingPaths[layer.id] = false;
                throw err;
            }

            this.loadingPaths[layer.id] = false;
        },
        paths: function(layer) {
            if (layer.type !== 'geojson') return;

            if (layer.id === 'cots') {
                return cotStore.paths();
            } else {
                return []
            }
        },
        getSource: function(layer) {
            return mapStore.map.getSource(layer.source)
        },
        flipVisible: async function(layer) {
            if (layer.visible === 'visible') {
                layer.visible = 'none';
                await mapStore.updateLayer(layer)
            } else {
                layer.visible = 'visible';
                await mapStore.updateLayer(layer)
            }
        },
        zoomTo: function(bounds) {
            mapStore.map.fitBounds(bounds);
        },
        updateOpacity: async function(layer) {
            await mapStore.updateLayer(layer)
        },
    },
    components: {
        MenuTemplate,
        OverlayLayers,
        TablerRange,
        TablerLoading,
        TablerDelete,
        IconGripVertical,
        IconChevronRight,
        IconChevronDown,
        IconMaximize,
        IconFolder,
        IconPencil,
        IconPencilCheck,
        IconEye,
        IconEyeOff,
        IconPlus,
        IconVector,
        IconMap
    }
}
</script>
