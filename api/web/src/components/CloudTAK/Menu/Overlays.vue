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
                <TablerLoading v-if='loading || !initialized' />
                <template v-else>
                    <div ref='sortable'>
                        <div
                            v-for='overlay in overlays'
                            :id='overlay.id'
                            :key='overlay.id'
                            class='col-lg py-2'
                        >
                            <div class='py-2 px-3'>
                                <div class='col-12 d-flex align-items-center'>
                                    <IconGripVertical
                                        v-if='isDraggable'
                                        v-tooltip='"Draw to reorder"'
                                        class='drag-handle cursor-move'
                                        :size='20'
                                        :stroke='1'
                                    />

                                    <IconChevronRight
                                        v-if='!isDraggable && !opened.includes(overlay.id)'
                                        :size='20'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click='opened.push(overlay.id)'
                                    />
                                    <IconChevronDown
                                        v-else-if='!isDraggable'
                                        :size='20'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click='opened.splice(opened.indexOf(overlay.id), 1)'
                                    />

                                    <span class='mx-2'>
                                        <IconMap
                                            v-if='overlay.type === "raster"'
                                            v-tooltip='"Raster"'
                                            :size='20'
                                            :stroke='1'
                                        />
                                        <IconVector
                                            v-else
                                            v-tooltip='"Vector"'
                                            :size='20'
                                            :stroke='1'
                                        />
                                    </span>

                                    <span
                                        class='mx-2 user-select-none'
                                        :class='{
                                            "cursor-pointer": ["data", "profile"].includes(overlay.mode) && overlay.type === "vector"
                                        }'
                                        @click='editor(overlay)'
                                        v-text='overlay.name'
                                    />

                                    <div class='ms-auto btn-list'>
                                        <IconMaximize
                                            v-if='getSource(overlay).bounds'
                                            v-tooltip='"Zoom To Overlay"'
                                            :size='20'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click.stop.prevent='zoomTo(overlay)'
                                        />
                                        <TablerDelete
                                            v-if='opened.includes(overlay.id) && (overlay.mode === "mission" || overlay.name.startsWith("data-") || overlay.name.startsWith("profile-"))'
                                            :key='overlay.id'
                                            v-tooltip='"Delete Overlay"'
                                            :size='20'
                                            displaytype='icon'
                                            @delete='removeLayer(overlay)'
                                        />

                                        <IconEye
                                            v-if='overlay.visible === "visible"'
                                            v-tooltip='"Hide Layer"'
                                            :size='20'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click.stop.prevent='flipVisible(overlay)'
                                        />
                                        <IconEyeOff
                                            v-else
                                            v-tooltip='"Show Layer"'
                                            :size='20'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click.stop.prevent='flipVisible(overlay)'
                                        />
                                    </div>
                                </div>
                            </div>

                            <template v-if='!isDraggable'>
                                <div
                                    v-if='overlay.type === "raster" && opened.includes(overlay.id)'
                                    class='col-12'
                                    style='margin-left: 30px; padding-right: 40px;'
                                >
                                    <TablerRange
                                        v-model='overlay.opacity'
                                        label='Opacity'
                                        :min='0'
                                        :max='1'
                                        :step='0.1'
                                        @change='updateOpacity(overlay)'
                                    />
                                </div>
                                <TreeCots
                                    v-else-if='overlay.type === "geojson" && overlay.id === "cots" && opened.includes(overlay.id)'
                                    :element='overlay'
                                />
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
import TreeCots from './Overlays/TreeCots.vue';
import {
    IconGripVertical,
    IconChevronRight,
    IconChevronDown,
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
import { mapState } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

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
            treeState: {
                cots: {
                    teams: {
                        _: false
                    }
                }
            },
            loadingPaths: {}
        }
    },
    computed: {
        ...mapState(useMapStore, ['overlays', 'initialized'])
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
        },
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
        zoomTo: function(layer) {
            const source = this.getSource(layer);
            if (!source || !source.bounds) return;
            mapStore.map.fitBounds(source.bounds);
        },
        updateOpacity: async function(layer) {
            await mapStore.updateLayer(layer)
        },
    },
    components: {
        MenuTemplate,
        TreeCots,
        OverlayLayers,
        TablerRange,
        TablerLoading,
        TablerDelete,
        IconGripVertical,
        IconChevronRight,
        IconChevronDown,
        IconMaximize,
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
