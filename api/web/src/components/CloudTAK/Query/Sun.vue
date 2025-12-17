<template>
    <div class='col-12 row g-0'>
        <div class='col-12'>
            <label class='subheader mx-2'>Sun Phase</label>
        </div>
        <div
            class='col-12 px-2 py-2 rounded'
            style='border: 1px solid var(--tblr-border-color);'
        >
            <div
                v-for='event in timeline'
                :key='event.time'
                class='d-flex align-items-center mb-2'
            >
                <template v-if='event.type === "now"'>
                    <div class='w-100 d-flex align-items-center text-red'>
                        <div class='flex-grow-1 border-top border-red' />
                        <span class='mx-2 small font-weight-bold'>Current Time</span>
                        <div class='flex-grow-1 border-top border-red' />
                    </div>
                </template>
                <template v-else>
                    <div
                        class='text-muted small text-end'
                        style='width: 60px;'
                        v-text='formatTime(event.time)'
                    />
                    <div class='mx-3 d-flex flex-column align-items-center'>
                        <component
                            :is='event.icon'
                            :size='24'
                            stroke='1'
                            :class='event.color'
                        />
                    </div>
                    <div>
                        <div v-text='event.name' />
                        <div
                            class='small text-muted'
                            v-text='fromNow(event.time)'
                        />
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import type { SearchReverse } from '../../../types.ts';
import moment from 'moment';
import {
    IconSunrise,
    IconSunset,
    IconSunHigh,
    IconSun,
    IconMoon,
    IconMoonStars
} from '@tabler/icons-vue';

const props = defineProps<{
    sun: SearchReverse["sun"]
}>();

const timeline = computed(() => {
    const events = [
        { name: 'Sunrise', time: props.sun.sunrise, icon: IconSunrise, color: 'text-orange', type: 'event' },
        { name: 'Sunset', time: props.sun.sunset, icon: IconSunset, color: 'text-orange', type: 'event' },
        { name: 'Dawn', time: props.sun.dawn, icon: IconSun, color: 'text-yellow', type: 'event' },
        { name: 'Dusk', time: props.sun.dusk, icon: IconMoon, color: 'text-blue', type: 'event' },
        { name: 'Solar Noon', time: props.sun.solarNoon, icon: IconSunHigh, color: 'text-yellow', type: 'event' },
        { name: 'Nadir', time: props.sun.nadir, icon: IconMoonStars, color: 'text-blue', type: 'event' },
    ];

    events.push({
        name: 'Current Time',
        time: new Date().toISOString(),
        // @ts-expect-error Icon is not needed for now
        icon: null,
        color: 'text-red',
        type: 'now'
    });

    return events.sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
    });
});

function formatTime(time: string) {
    return moment(time).format('HH:mm');
}

function fromNow(time: string) {
    return moment(time).fromNow();
}
</script>
