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
                <IconPlus
                    v-tooltip='"Add Overlay"'
                    class='cursor-pointer'
                    size='32'
                    @click='$router.push("/menu/datas")'
                />
            </template>
            <template #default>
                <TablerLoading v-if='loading' />
                <template v-else>
                    <div
                        v-for='layer in layers'
                        :key='layer.url'
                        class='col-lg py-2'
                    >
                        <div class='py-2 px-3'>
                            <div class='col-12 d-flex align-items-center'>
                                <IconEye
                                    v-if='layer.visible === "visible"'
                                    v-tooltip='"Hide Layer"'
                                    size='32'
                                    class='cursor-pointer'
                                    @click.stop.prevent='flipVisible(layer)'
                                />
                                <IconEyeOff
                                    v-else
                                    v-tooltip='"Show Layer"'
                                    size='32'
                                    class='cursor-pointer'
                                    @click.stop.prevent='flipVisible(layer)'
                                />

                                <span class='mx-2'>
                                    <IconMap
                                        v-if='layer.type === "raster"'
                                        v-tooltip='"Raster"'
                                        size='32'
                                    />
                                    <IconVector
                                        v-else
                                        v-tooltip='"Vector"'
                                        size='32'
                                    />
                                </span>

                                <span
                                    class='mx-2 user-select-none'
                                    :class='{
                                        "cursor-pointer": ["data", "profile"].includes(layer.mode) && layer.type === "vector"
                                    }'
                                    @click='editor(layer)'
                                    v-text='layer.name'
                                />

                                <div class='ms-auto btn-list'>
                                    <IconMaximize
                                        v-if='getSource(layer).bounds'
                                        v-tooltip='"Zoom To Overlay"'
                                        size='32'
                                        class='cursor-pointer'
                                        @click.stop.prevent='zoomTo(getSource(layer).bounds)'
                                    />
                                    <TablerDelete
                                        v-if='layer.mode === "mission" || layer.name.startsWith("data-") || layer.name.startsWith("profile-")'
                                        :key='layer.id'
                                        v-tooltip='"Delete Overlay"'
                                        displaytype='icon'
                                        @delete='removeLayer(layer)'
                                    />
                                </div>
                            </div>
                        </div>

                        <div
                            v-if='layer.type === "raster"'
                            class='col-12'
                            style='margin-left: 30px; padding-right: 40px;'
                            step=''
                        >
                            <TablerRange
                                v-model='layer.opacity'
                                label='Opacity'
                                :min='0'
                                :max='1'
                                :step='0.1'
                                @change='updateOpacity(layer)'
                            />
                        </div>
                        <div v-else-if='layer.type === "geojson"'>
                            <div v-for='path in paths(layer)' class='d-flex align-items-center hover-dark px-3 py-2'>
                                <IconFolder size='32'/><span v-text='path' class='mx-2'/>
                                <div class='ms-auto'>
                                    <TablerDelete displaytype='icon'/>
                                </div>
                            </div>
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
    IconMaximize,
    IconVector,
    IconFolder,
    IconEyeOff,
    IconPlus,
    IconEye,
    IconMap
} from '@tabler/icons-vue';
import { mapState } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();

export default {
    name: 'CloudTAKOverlays',
    data: function() {
        return {
            err: false,
            isEditing: false,
            loading: false,
        }
    },
    computed: {
        ...mapState(useMapStore, ['layers'])
    },
    methods: {
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
        IconMaximize,
        IconFolder,
        IconEye,
        IconEyeOff,
        IconPlus,
        IconVector,
        IconMap
    }
}
</script>
