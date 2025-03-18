<template>
    <MenuTemplate
        name='Saved Features'
        :loading='loading || !mapStore.isLoaded'
    >
        <template #default>
            <Feature
                v-for='cot of cots.values()'
                :key='cot.id'
                :feature='cot'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import COT from '../../../base/cot.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import Feature from '../util/Feature.vue';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

const cots = ref<Set<COT>>(new Set());
const loading = ref(true);

onMounted(async () => {
    cots.value = await mapStore.worker.db.pathFeatures();

    loading.value = false
});

</script>
