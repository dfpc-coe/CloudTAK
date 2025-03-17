<template>
    <MenuTemplate
        name='Saved Features'
        :loading='loading || !mapStore.isLoaded'
    >
        <template #default>
            <TreeCots
                :element='overlay'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import TreeCots from './Overlays/TreeCots.vue';
import { useMapStore } from '../../../../src/stores/map.ts';

const mapStore = useMapStore();
const router = useRouter();

const loading = ref(false);

</script>
