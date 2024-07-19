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
                <TablerLoading v-if='loading || !isLoaded' />
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
                                            v-if='opened.includes(overlay.id) && ["mission", "data", "profile"].includes(overlay.mode)'
                                            :key='overlay.id'
                                            v-tooltip='"Delete Overlay"'
                                            :size='20'
                                            displaytype='icon'
                                            @delete='removeOverlay(overlay)'
                                        />

                                        <IconEye
                                            v-if='overlay.visible'
                                            v-tooltip='"Hide Layer"'
                                            :size='20'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click.stop.prevent='overlay.update({ visible: !overlay.visible })'
                                        />
                                        <IconEyeOff
                                            v-else
                                            v-tooltip='"Show Layer"'
                                            :size='20'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click.stop.prevent='overlay.update({ visible: !overlay.visible })'
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
                                        @change='overlay.update({
                                            opacity: overlay.opacity
                                        })'
                                    />
                                </div>
                                <TreeCots
                                    v-else-if='overlay.type === "geojson" && overlay.id === -1 && opened.includes(overlay.id)'
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
        ...mapState(useMapStore, ['overlays', 'isLoaded'])
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
            // TODO: Eventually it would be awesome to just move the Overlay in the overlays array
            // And the MapStore would just dynamically re-order the layers so any part of the app could reorder

            const overlay_ids = sortable.toArray().map((i) => {
                return parseInt(i)
            });

            const overlay = mapStore.getOverlayById(parseInt(sortableEv.item.getAttribute('id')))

            const post = mapStore.getOverlayById(overlay_ids[sortableEv.newIndex + 1]);

            for (const l of overlay._layers) {
                mapStore.map.moveLayer(l.id, post._layers[0].id)
            }

            for (const overlay of this.overlays) {
                await overlay.update({
                    pos: overlay_ids.indexOf(overlay.id)
                });
            }
        },
        removeOverlay: async function(overlay) {
            this.loading = true;
            await mapStore.removeOverlay(overlay);
            this.loading = false;
        },
        editor: function(overlay) {
            if (["data", "profile"].includes(overlay.mode) && overlay.type === "vector") {
                this.isEditing = overlay;
            }
        },
        getSource: function(overlay) {
            return mapStore.map.getSource(String(overlay.id))
        },
        zoomTo: function(layer) {
            const source = this.getSource(layer);
            if (!source || !source.bounds) return;
            mapStore.map.fitBounds(source.bounds);
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
