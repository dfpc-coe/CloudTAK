<template>
    <div class='ps-3'>
        <div
            v-if='advanced || l.filter'
            class='col-lg-12'
        >
            <label class='subheader'>Filter</label>
            <div class='12'>
                <CopyField
                    :modelValue='JSON.stringify(l.filter) || "None"'
                    :edit='!disabled'
                    :hover='!disabled'
                />
        </div>
        </div>
        <div
            v-if='advanced || l["minzoom"] || l["maxzoom"]'
            class='col-12 row g-0'
        >
            <label class='subheader'>Zoom Limits</label>

            <div class='col-12 col-md-6 pe-md-1'>
                <CopyField
                    :modelValue='l.minzoom || "Not Set"'
                    :edit='!disabled'
                    :hover='!disabled'
                />
            </div>
            <div class='col-12 col-md-6 ps-md-1'>
                <CopyField
                    :modelValue='l.maxzoom || "Not Set"'
                    :edit='!disabled'
                    :hover='!disabled'
                />
            </div>
        </div>
        <div
            v-if='advanced || l["source-layer"]'
            class='col-12'
        >
            <label class='subheader'>Source Layer</label>
            <CopyField
                :modelValue='l["source-layer"] || None'
                :edit='!disabled'
                :hover='!disabled'
            />
        </div>
        <div class='col-12'>
            <label class='subheader'>Layout</label>
            <div
                v-if='Object.keys(l.layout).length === 0'
                class='col-12 d-flex py-1'
            >
                <TablerNone :compact='true' label='Layout Properties' :create='false'/>
            </div>
            <div
                v-for='p of Object.keys(l.layout)'
                :key='p'
                class='col-12 py-1'
            >
                <template v-if='p === "visibility"'>
                    <TablerToggle
                        v-model='l.layout[p]'
                        :label='p'
                    />
                </template>
                <template v-else>
                    <span v-text='p' />

                    <span
                        class='ms-auto'
                        v-text='l.layout[p]'
                    />
                </template>
            </div>
        </div>
        <div class='col-lg'>
            <label class='subheader'>Paint</label>
            <div
                v-if='Object.keys(l.paint).length === 0'
                class='col-12 px-2 py-1'
            >
                <TablerNone :compact='true' label='Paint Properties' :create='false'/>
            </div>
            <div
                v-for='p of Object.keys(l.paint)'
                :key='p'
                class='col-12'
            >
                <template v-if='["fill-opacity", "line-opacity", "marker-opacity", "fill-outline-color"].includes(p)'>
                    <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "number"'>
                        <TablerRange
                            v-model='l.paint[p][l.paint[p].length -1]'
                            class='w-100'
                            label='Opacity'
                            :min='0'
                            :max='1'
                            :step='0.1'
                        >
                            <span
                                class='float-right'
                                v-text='Math.round(l.paint[p][l.paint[p].length -1] * 100) + "%"'
                            />
                        </TablerRange>
                    </template>
                    <template v-else-if='!isNaN(Number(l.paint[p]))'>
                        <TablerRange
                            v-model='l.paint[p]'
                            class='w-100'
                            label='Opacity'
                            :min='0'
                            :max='1'
                            :step='0.1'
                        >
                            <span
                                class='float-right'
                                v-text='Math.round(l.paint[p] * 100) + "%"'
                            />
                        </TablerRange>
                    </template>
                    <template v-else>
                        <span v-text='p' />
                        <pre v-text='l.paint[p]' />
                    </template>
                </template>
                <template v-else-if='["line-width", "circle-radius"].includes(p)'>
                    <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "number"'>
                        <TablerRange
                            v-model='l.paint[p][l.paint[p].length -1]'
                            class='w-100'
                            label='Width'
                            :min='1'
                            :max='10'
                            :step='1'
                        >
                            <span
                                class='float-right'
                                v-text='l.paint[p][l.paint[p].length -1]'
                            />
                        </TablerRange>
                    </template>
                    <template v-else-if='!isNaN(Number(l.paint[p]))'>
                        <TablerRange
                            v-model='l.paint[p]'
                            class='w-100'
                            label='Width'
                            :min='1'
                            :max='10'
                            :step='1'
                        >
                            <span
                                class='float-right'
                                v-text='l.paint[p]'
                            />
                        </TablerRange>
                    </template>
                    <template v-else>
                        <span v-text='p' />
                        <pre v-text='l.paint[p]' />
                    </template>
                </template>
                <template v-else-if='["fill-color", "line-color", "circle-color", "text-color", "text-halo-color", "fill-outline-color"].includes(p)'>
                    <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "string"'>
                        <TablerInput
                            v-model='l.paint[p][l.paint[p].length -1]'
                            class='w-100'
                            type='color'
                            :label='p'
                        >
                            <span
                                class='float-right'
                                v-text='l.paint[p][l.paint[p].length -1]'
                            />
                        </TablerInput>
                    </template>
                    <template v-else-if='typeof l.paint[p] === "string"'>
                        <TablerInput
                            v-model='l.paint[p]'
                            class='w-100'
                            type='color'
                            :label='p'
                        >
                            <span
                                class='float-right'
                                v-text='l.paint[p]'
                            />
                        </TablerInput>
                    </template>
                    <template v-else>
                        <span v-text='p' />
                        <pre v-text='l.paint[p]' />
                    </template>
                </template>
                <template v-else>
                    <div v-text='p' />
                    <CopyField
                        :modelValue='l.paint[p]'
                        :edit='!disabled'
                        :hover='!disabled'
                    />
                </template>
            </div>
        </div>
    </div>
</template>

<script>
import {
    TablerNone,
    TablerInput,
    TablerToggle,
    TablerRange
} from '@tak-ps/vue-tabler';
import CopyField from '../CloudTAK/util/CopyField.vue';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();

export default {
    name: 'OverlayLayer',
    components: {
        CopyField,
        TablerNone,
        TablerRange,
        TablerToggle,
        TablerInput,
    },
    props: {
        disabled: {
            type: Boolean,
            default: false
        },
        advanced: {
            type: Boolean,
            default: false
        },
        layer: {
            type: Object,
            required: true
        },
        updateMap: {
            type: Boolean,
            default: true
        }
    },
    data: function() {
        return {
            err: false,
            loading: false,
            l: this.layer
        }
    },
    watch: {
        l: {
            deep: true,
            handler: function() {
                if (!this.updateMap) return;

                for (const paint of [
                    'fill-opacity',
                    'fill-color',
                    'line-opacity',
                    'line-color',
                    'line-width',
                    'text-halo-width',
                    'text-halo-blur'
                ]) {
                    if (this.l.paint[paint]) {
                        mapStore.map.setPaintProperty(String(this.l.id), paint, this.l.paint[paint]);
                    }
                }
            }
        }
    }
}
</script>
