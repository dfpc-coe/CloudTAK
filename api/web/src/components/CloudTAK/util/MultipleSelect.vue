<template>
    <div
        ref='selectMenu'
        class='position-absolute bg-dark rounded'
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
            class='col-12 text-white'
            @click='$emit("selected", feat)'
        >
            <Feature
                :feature='feat'
                :compact='true'
                :delete-button='false'
            />
        </div>
    </div>
</template>

<script>
import Feature from './Feature.vue'
import { useMapStore } from '/src/stores/map.ts';
import { mapState, mapActions } from 'pinia'

export default {
    name: 'MultipleSelect',
    components: {
        Feature
    },
    emits: [
        'selected'
    ],
    computed: {
        ...mapState(useMapStore, ['select']),
    },
    methods: {
        ...mapActions(useMapStore, ['radialClick']),
    },
}
</script>
