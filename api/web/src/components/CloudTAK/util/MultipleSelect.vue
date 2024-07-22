<template>
    <div
        ref='selectMenu'
        class='position-absolute bg-white rounded'
        style='
            width: 200px;
            z-index: 1;
        '
        :style='{
            top: `${select.y}px`,
            left: `${select.x - 100}px`,
        }'
    >
        <div
            v-for='feat in select.feats'
            :key='feat.properties.id'
            class='col-12 d-flex align-items-center cursor-pointer hover-light'
            @click='radialClick(feat, {
                point: select.e.point,
                lngLat: select.e.lngLat
            })'
        >
            <IconPoint
                v-if='feat.geometry.type.includes("Point")'
                :size='20'
                :stroke='1'
            />
            <IconLine
                v-else-if='feat.geometry.type.includes("Line")'
                :size='20'
                :stroke='1'
            />
            <IconPolygon
                v-else-if='feat.geometry.type.includes("Polygon")'
                :size='20'
                :stroke='1'
            />
            <div
                class='subheader'
                v-text='feat.properties.callsign || "No Name"'
            />
        </div>
    </div>
</template>

<script>
import {
    IconPoint,
    IconLine,
    IconPolygon
} from '@tabler/icons-vue';
import { useMapStore } from '/src/stores/map.ts';
import { mapState, mapActions } from 'pinia'

export default {
    name: 'MultipleSelect',
    components: {
        IconPoint,
        IconLine,
        IconPolygon
    },
    computed: {
        ...mapState(useMapStore, ['select']),
    },
    methods: {
        ...mapActions(useMapStore, ['radialClick']),
    },
}
</script>
