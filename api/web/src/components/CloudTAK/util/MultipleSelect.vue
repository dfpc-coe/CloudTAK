<template>
    <div
        ref='selectMenu'
        role='menu'
        class='position-absolute bg-dark rounded'
        style='
            width: 200px;
            z-index: 1;
        '
        :style='{
            top: `${mapStore.select.y}px`,
            left: `${mapStore.select.x - 100}px`,
        }'
    >
        <div
            v-for='feat in mapStore.select.feats'
            :key='feat.properties.id'
            role='menuitem'
            tabindex='0'
            class='col-12 text-white'
            @click='emit("selected", feat)'
        >
            <Feature
                :feature='feat'
                :compact='true'
                :delete-button='false'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import Feature from './FeatureRow.vue'
import { useMapStore } from '../../../stores/map.ts';

const emit = defineEmits([ 'selected' ]);

const mapStore = useMapStore();
</script>
