<template>
    <div class='col-lg px-3'>
        <label class='subheader'>Filter</label>
        <pre
            class='col-12 px-2 py-1'
            v-text='JSON.stringify(l.filter)'
        />
    </div>
    <div class='col-lg px-3'>
        <label class='subheader'>Source Layer</label>
        <pre
            class='col-12 px-2 py-1'
            v-text='JSON.stringify(l["source-layer"])'
        />
    </div>
    <div class='col-lg px-3'>
        <label class='subheader'>Layout</label>
        <div
            v-if='Object.keys(l.layout).length === 0'
            class='col-12 d-flex px-2 py-1'
        >
            None
        </div>
        <div
            v-for='p of Object.keys(l.layout)'
            :key='p'
            class='col-12 d-flex px-2 py-1'
        >
            <span v-text='p' />

            <span
                class='ms-auto'
                v-text='l.layout[p]'
            />
        </div>
    </div>
    <div class='col-lg px-3'>
        <label class='subheader'>Paint</label>
        <div
            v-if='Object.keys(l.paint).length === 0'
            class='col-12 d-flex px-2 py-1'
        >
            None
        </div>
        <div
            v-for='p of Object.keys(l.paint)'
            :key='p'
            class='col-12 d-flex px-2'
        >
            <template v-if='["fill-opacity", "line-opacity", "marker-opacity"].includes(p)'>
                <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "number"'>
                    <TablerRange
                        v-model='l.paint[p][l.paint[p].length -1]'
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
                    <pre v-text='l.paint[p]' />
                </template>
            </template>
            <template v-else-if='["line-width", "circle-radius"].includes(p)'>
                <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "number"'>
                    <TablerRange
                        v-model='l.paint[p][l.paint[p].length -1]'
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
                    <pre v-text='l.paint[p]' />
                </template>
            </template>
            <template v-else-if='["fill-color", "line-color", "circle-color"].includes(p)'>
                <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "string"'>
                    <TablerInput
                        v-model='l.paint[p][l.paint[p].length -1]'
                        class='w-100'
                        type='color'
                        label='Colour'
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
                        label='Colour'
                    >
                        <span
                            class='float-right'
                            v-text='l.paint[p]'
                        />
                    </TablerInput>
                </template>
                <template v-else>
                    <pre v-text='l.paint[p]' />
                </template>
            </template>
            <template v-else>
                <span v-text='p' />
                <span
                    class='ms-auto'
                    v-text='l.paint[p]'
                />
            </template>
        </div>
    </div>
</template>

<script>
import {
    TablerInput,
    TablerRange
} from '@tak-ps/vue-tabler';
import { useMapStore } from '/src/stores/map.ts';
import { mapState } from 'pinia'
const mapStore = useMapStore();

export default {
    name: 'OverlayLayer',
    props: {
        layer: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            err: false,
            loading: false,
            l: this.layer
        }
    },
    computed: {
        ...mapState(useMapStore, ['layers'])
    },
    watch: {
        l: {
            deep: true,
            handler: function() {
                for (const paint of ['fill-opacity', 'fill-color', 'line-opacity', 'line-color', 'line-width']) {
                    if (this.l.paint[paint]) {
                        mapStore.map.setPaintProperty(this.l.id, paint, this.l.paint[paint]);
                    }
                }
            }
        }
    },
    components: {
        TablerRange,
        TablerInput,
    }
}
</script>
