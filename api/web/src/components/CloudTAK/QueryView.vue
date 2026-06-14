<template>
    <MenuTemplate name='Query Mode'>
        <template #buttons>
            <TablerIconButton
                title='Create Route'
                @click='openRoute'
            >
                <IconRoute
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                title='Refresh'
                @click='refreshKey++'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <Coordinate
            v-if='coords'
            :model-value='coords'
            class='py-2'
        />

        <template v-if='coords && coords.length >= 2'>
            <QueryReverse
                :key='`reverse-${refreshKey}`'
                :longitude='coords[0]'
                :latitude='coords[1]'
                class='py-2'
            />

            <QueryElevation
                :key='`elevation-${refreshKey}`'
                :longitude='coords[0]'
                :latitude='coords[1]'
                class='py-2'
            />

            <QueryWeather
                :key='`weather-${refreshKey}`'
                :longitude='coords[0]'
                :latitude='coords[1]'
                class='py-2'
            />

            <QuerySun
                :key='`sun-${refreshKey}`'
                :longitude='coords[0]'
                :latitude='coords[1]'
                class='py-2'
            />

            <QueryMagnetic
                :key='`magnetic-${refreshKey}`'
                :longitude='coords[0]'
                :latitude='coords[1]'
                class='py-2'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    IconRefresh,
    IconRoute
} from '@tabler/icons-vue';
import QueryWeather from './Query/Weather.vue';
import QuerySun from './Query/Sun.vue';
import QueryMagnetic from './Query/Magnetic.vue';
import QueryReverse from './Query/Reverse.vue';
import QueryElevation from './Query/Elevation.vue';
import {
    TablerIconButton
} from '@tak-ps/vue-tabler';
import Coordinate from './util/Coordinate.vue';
import MenuTemplate from './util/MenuTemplate.vue';

const route = useRoute();
const router = useRouter();

const refreshKey = ref(0);

const coords = computed<number[] | undefined>(() => {
    return route.params.coords
        ? String(route.params.coords).split(',').map(c => Number(c))
        : undefined
});

watch(coords, () => {
    refreshKey.value++;
});

function openRoute() {
    if (coords.value && coords.value.length >= 2) {
        router.push(`/menu/routes/new?end=${coords.value[0]},${coords.value[1]}`);
    }
}
</script>
