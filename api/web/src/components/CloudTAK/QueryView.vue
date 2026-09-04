<template>
    <MenuTemplate name='Query Mode'>
        <template #buttons>
            <TablerIconButton
                v-if='coords && coords.length >= 2'
                :title='isNavigating ? "End Navigation" : "Navigate"'
                @click='toggleNavigation'
            >
                <IconNavigationFilled
                    v-if='isNavigating'
                    :size='32'
                    stroke='1'
                    style='color: #1E90FF;'
                />
                <IconNavigation
                    v-else
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
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
            <div class='px-2 py-2'>
                <button
                    class='btn btn-success w-100'
                    @click='eventModal = true'
                >
                    Create Event
                </button>
            </div>

            <QueryReverse
                :key='`reverse-${refreshKey}`'
                :longitude='coords[0]'
                :latitude='coords[1]'
                class='py-2'
                @reverse='reverse = $event'
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

    <CreateCoreEvent
        v-if='eventModal && coords && coords.length >= 2'
        :coordinates='coords'
        :location='reverse ? reverse.LongLabel : ""'
        @close='eventModal = false'
    />
</template>

<script setup lang='ts'>
import { ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMapStore } from '../../stores/map.ts';
import type { SearchReverseReverse } from '../../types.ts';
import {
    IconRefresh,
    IconRoute,
    IconNavigation,
    IconNavigationFilled
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
import CreateCoreEvent from './util/CreateCoreEvent.vue';

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const refreshKey = ref(0);
const eventModal = ref(false);
const reverse = ref<SearchReverseReverse['reverse']>(null);

const coords = computed<number[] | undefined>(() => {
    return route.params.coords
        ? String(route.params.coords).split(',').map(c => Number(c))
        : undefined
});

watch(coords, () => {
    reverse.value = null;
    refreshKey.value++;
});

const isNavigating = computed(() => {
    const dest = mapStore.navigation.destination;
    return mapStore.navigation.active
        && !mapStore.navigation.cotId
        && !!dest
        && !!coords.value
        && dest[0] === coords.value[0]
        && dest[1] === coords.value[1];
});

function toggleNavigation() {
    if (isNavigating.value) {
        mapStore.stopNavigation();
    } else if (coords.value && coords.value.length >= 2) {
        mapStore.navigateTo(
            [coords.value[0], coords.value[1]],
            reverse.value ? reverse.value.LongLabel : undefined
        );
    }
}

function openRoute() {
    if (coords.value && coords.value.length >= 2) {
        router.push(`/menu/routes/new?end=${coords.value[0]},${coords.value[1]}`);
    }
}
</script>
