<template>
<MenuTemplate :name='l.id'>
    <div class="col-lg py-2 px-3">
        <label class='subheader pb-2'>Filter</label>
        <div class='col-12 bg-gray-500 px-2 my-2 py-2'>
            <span v-text='l.filter'/>
        </div>
    </div>
    <div class="col-lg py-2 px-3">
        <label class='subheader pb-2'>Source Layer</label>
        <div class='col-12 bg-gray-500 px-2 my-2 py-2'>
            <span v-text='l["source-layer"]'/>
        </div>
    </div>
    <div class="col-lg py-2 px-3">
        <label class='subheader'>Layout</label>
        <div v-if='Object.keys(l.layout).length === 0' class='col-12 d-flex bg-gray-500 px-2 my-2 py-2'>
            None
        </div>
        <div :key='p' v-for='p of Object.keys(l.layout)' class='col-12 d-flex bg-gray-500 px-2 my-2 py-2'>
            <span v-text='p'/>

            <span class='ms-auto' v-text='l.layout[p]'/>
        </div>
    </div>
    <div class="col-lg py-2 px-3">
        <label class='subheader'>Paint</label>
        <div v-if='Object.keys(l.paint).length === 0' class='col-12 d-flex bg-gray-500 px-2 my-2 py-2'>
            None
        </div>
        <div :key='p' v-for='p of Object.keys(l.paint)' class='col-12 d-flex bg-gray-500 px-2 my-2 py-2'>
            <template v-if='["fill-opacity", "line-opacity", "circle-opacity"].includes(p)'>
                <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "number"'>
                    <TablerRange label='Opacity' v-model='l.paint[p][l.paint[p].length -1]' :min='0' :max='1' :step='0.1'>
                        <span class='float-right' v-text='Math.round(l.paint[p][l.paint[p].length -1] * 100) + "%"'/>
                    </TablerRange>
                </template>
                <template v-else-if='!isNaN(Number(l.paint[p]))'>
                    <TablerRange label='Opacity' v-model='l.paint[p]' :min='0' :max='1' :step='0.1'>
                        <span class='float-right' v-text='Math.round(l.paint[p] * 100) + "%"'/>
                    </TablerRange>
                </template>
                <template v-else>
                    <pre v-text='l.paint[p]'/>
                </template>
            </template>
            <template v-else-if='["line-width", "circle-radius"].includes(p)'>
                <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "number"'>
                    <TablerRange label='Width' v-model='l.paint[p][l.paint[p].length -1]' :min='1' :max='10' :step='1'>
                        <span class='float-right' v-text='l.paint[p][l.paint[p].length -1]'/>
                    </TablerRange>
                </template>
                <template v-else-if='!isNaN(Number(l.paint[p]))'>
                    <TablerRange label='Width' v-model='l.paint[p]' :min='1' :max='10' :step='1'>
                        <span class='float-right' v-text='l.paint[p]'/>
                    </TablerRange>
                </template>
                <template v-else>
                    <pre v-text='l.paint[p]'/>
                </template>
            </template>
            <template v-else-if='["fill-color", "line-color", "circle-color"].includes(p)'>
                <template v-if='Array.isArray(l.paint[p]) && l.paint[p][0] === "string"'>
                    <TablerInput class='w-100' type='color' label='Colour' v-model='l.paint[p][l.paint[p].length -1]'>
                        <span class='float-right' v-text='l.paint[p][l.paint[p].length -1]'/>
                    </TablerInput>
                </template>
                <template v-else-if='typeof l.paint[p] === "string"'>
                    <TablerInput class='w-100' type='color' label='Colour' v-model='l.paint[p]'>
                        <span class='float-right' v-text='l.paint[p]'/>
                    </TablerInput>
                </template>
                <template v-else>
                    <pre v-text='l.paint[p]'/>
                </template>
            </template>
            <template v-else>
                <span v-text='p'/>
                <span class='ms-auto' v-text='l.paint[p]'/>
            </template>
        </div>
    </div>
</MenuTemplate>
</template>

<script>
import {
    TablerInput,
    TablerRange
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
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
        MenuTemplate,
        TablerRange,
        TablerInput,
    }
}
</script>
