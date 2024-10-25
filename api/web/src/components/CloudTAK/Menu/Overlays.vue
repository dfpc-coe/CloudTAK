<template>
    <MenuTemplate name='Overlays'>
        <template #buttons>
            <TablerIconButton
                v-if='isDraggable === false'
                title='"Edit Order"'
                @click='isDraggable = true'
            ><IconPencil :size='32' :stroke='1' /></TablerIconButton>

            <TablerIconButton
                v-else-if='isDraggable === true'
                title='"Save Order"'
                @click='isDraggable = false'
            ><IconPencilCheck :size='32' :stroke='1'/></TablerIconButton>

            <TablerIconButton
                v-if='!isDraggable'
                title='"Add Overlay"'
                @click='$router.push("/menu/datas")'
            ><IconPlus :size='32' :stroke='1' /></TablerIconButton>
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
                                    role='button'
                                    tabindex='0'
                                    :size='20'
                                    :stroke='1'
                                />

                                <template v-if='!overlay.healthy()'>
                                    <IconAlertTriangle
                                        v-if='!isDraggable && !opened.includes(overlay.id)'
                                        v-tooltip='overlay._error.message'
                                        :size='20'
                                        :stroke='1'
                                    />
                                </template>
                                <template v-else-if='overlay.id !== 0'>
                                    <IconChevronRight
                                        v-if='!isDraggable && !opened.includes(overlay.id)'
                                        :size='20'
                                        :stroke='1'
                                        role='button'
                                        tabindex='0'
                                        class='cursor-pointer'
                                        @click='opened.push(overlay.id)'
                                    />
                                    <IconChevronDown
                                        v-else-if='!isDraggable'
                                        :size='20'
                                        :stroke='1'
                                        role='button'
                                        tabindex='0'
                                        class='cursor-pointer'
                                        @click='opened.splice(opened.indexOf(overlay.id), 1)'
                                    />
                                </template>

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
                                    class='mx-2 user-select-none text-truncate'
                                    style='width: 200px;'
                                    :class='{
                                        "cursor-pointer": ["data", "profile"].includes(overlay.mode)
                                            && overlay.type === "vector"
                                    }'
                                    v-text='overlay.name'
                                />

                                <div class='ms-auto btn-list'>
                                    <IconMaximize
                                        v-if='getSource(overlay).bounds'
                                        v-tooltip='"Zoom To Overlay"'
                                        :size='20'
                                        :stroke='1'
                                        role='button'
                                        tabindex='0'
                                        class='cursor-pointer'
                                        @click.stop.prevent='zoomTo(overlay)'
                                    />
                                    <TablerDelete
                                        v-if='
                                            opened.includes(overlay.id)
                                                && ["mission", "data", "profile", "overlay"].includes(overlay.mode)
                                        '
                                        :key='overlay.id'
                                        v-tooltip='"Delete Overlay"'
                                        :size='20'
                                        role='button'
                                        tabindex='0'
                                        displaytype='icon'
                                        @delete='removeOverlay(overlay)'
                                    />

                                    <IconEye
                                        v-if='overlay.visible'
                                        v-tooltip='"Hide Layer"'
                                        :size='20'
                                        :stroke='1'
                                        role='button'
                                        tabindex='0'
                                        class='cursor-pointer'
                                        @click.stop.prevent='overlay.update({ visible: !overlay.visible })'
                                    />
                                    <IconEyeOff
                                        v-else
                                        v-tooltip='"Show Layer"'
                                        role='button'
                                        tabindex='0'
                                        :size='20'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click.stop.prevent='overlay.update({ visible: !overlay.visible })'
                                    />
                                </div>
                            </div>
                        </div>

                        <template v-if='!isDraggable && opened.includes(overlay.id)'>
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

<script>
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

            for (const l of overlay.styles) {
                if (post) {
                    mapStore.map.moveLayer(l.id, post.styles[0].id)
                } else {
                    mapStore.map.moveLayer(l.id)
                }
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
        TreeVector,
        TreeMission,
        TablerRange,
        TablerIconButton,
        TablerLoading,
        TablerDelete,
        IconGripVertical,
        IconAlertTriangle,
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
