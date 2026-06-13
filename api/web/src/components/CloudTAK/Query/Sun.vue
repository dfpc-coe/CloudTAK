<template>
    <div class='col-12 row g-0'>
        <div class='col-12'>
            <label class='subheader mx-2'>Sun Phase</label>
        </div>
        <TablerLoading
            v-if='loading'
            desc='Loading sun data...'
        />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else-if='sun'
            class='col-12 px-2 py-2 rounded'
            style='border: 1px solid var(--tblr-border-color);'
        >
            <template
                v-for='event in timeline'
                :key='event.time'
            >
                <div
                    v-if='event.name === "Nadir"'
                    class='d-flex align-items-center mb-2'
                >
                    <div
                        class='text-muted small text-end'
                        style='width: 60px;'
                    >
                        Prev Night
                    </div>
                    <div class='mx-3 d-flex flex-column align-items-center'>
                        <IconMoonStars
                            :size='24'
                            stroke='1'
                            class='text-muted'
                        />
                    </div>
                    <div>
                        <div v-text='prevMoon.phase' />
                        <div
                            class='small text-muted'
                            v-text='prevMoon.illumination + "% Illuminated"'
                        />
                    </div>
                </div>

                <div class='d-flex align-items-center mb-2'>
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
            </template>

            <div class='d-flex align-items-center border-top pt-2 mt-2'>
                <div
                    class='text-muted small text-end'
                    style='width: 60px;'
                >
                    Moon
                </div>
                <div class='mx-3 d-flex flex-column align-items-center'>
                    <IconMoonStars
                        :size='24'
                        stroke='1'
                        class='text-muted'
                    />
                </div>
                <div>
                    <div v-text='moon.phase' />
                    <div
                        class='small text-muted'
                        v-text='moon.illumination + "% Illuminated"'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, type Component } from 'vue';
import type { SearchReverseSun } from '../../../types.ts';
import { server } from '../../../std.ts';
import {
    IconSunrise,
    IconSunset,
    IconSunHigh,
    IconSun,
    IconMoon,
    IconMoonStars
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerAlert
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    longitude: number;
    latitude: number;
}>();

const loading = ref(true);
const error = ref<Error | undefined>();
const sun = ref<SearchReverseSun['sun'] | null>(null);

onMounted(async () => {
    try {
        const { data, error: reqError } = await server.GET('/api/search/reverse/{:longitude}/{:latitude}/sun', {
            params: {
                path: { ':longitude': props.longitude, ':latitude': props.latitude },
                query: { altitude: 0 },
            },
        });

        if (reqError) throw new Error(String(reqError));
        sun.value = data.sun;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
});

type TimelineEvent = {
    name: string;
    time: string;
    icon: Component | null;
    color: string;
    type: 'event' | 'now';
};

const timeline = computed(() => {
    if (!sun.value) return [];

    const events: TimelineEvent[] = [];

    const addEvent = (name: string, time: string | null, icon: Component, color: string) => {
        if (!time) return;

        events.push({ name, time, icon, color, type: 'event' });
    };

    addEvent('Sunrise', sun.value.sunrise, IconSunrise, 'text-orange');
    addEvent('Sunset', sun.value.sunset, IconSunset, 'text-orange');
    addEvent('Dawn', sun.value.dawn, IconSun, 'text-yellow');
    addEvent('Dusk', sun.value.dusk, IconMoon, 'text-blue');
    addEvent('Solar Noon', sun.value.solarNoon, IconSunHigh, 'text-yellow');
    addEvent('Nadir', sun.value.nadir, IconMoonStars, 'text-blue');

    events.push({
        name: 'Current Time',
        time: new Date().toISOString(),
        icon: null,
        color: 'text-red',
        type: 'now'
    });

    return events.sort((a, b) => {
        return new Date(a.time).getTime() - new Date(b.time).getTime();
    });
});

function getMoonPhase(date: Date) {
    const cycles = 29.5305882;
    const knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
    const diff = date.getTime() - knownNewMoon;
    const days = diff / (1000 * 60 * 60 * 24);
    const lunations = days / cycles;
    const currentLunation = lunations - Math.floor(lunations);

    const phase = currentLunation * 8;
    const index = Math.round(phase) % 8;

    const phases = [
        'New Moon',
        'Waxing Crescent',
        'First Quarter',
        'Waxing Gibbous',
        'Full Moon',
        'Waning Gibbous',
        'Last Quarter',
        'Waning Crescent'
    ];

    return {
        phase: phases[index],
        illumination: Math.round((1 - Math.cos(currentLunation * 2 * Math.PI)) / 2 * 100)
    };
}

const moon = computed(() => getMoonPhase(new Date()));
const prevMoon = computed(() => getMoonPhase(new Date(Date.now() - 86400000)));

const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto'
});

const relativeTimeUnits = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'week', seconds: 604800 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 }
] as const;

function formatTime(time: string) {
    return timeFormatter.format(new Date(time));
}

function fromNow(time: string) {
    const seconds = Math.round((new Date(time).getTime() - Date.now()) / 1000);
    const absSeconds = Math.abs(seconds);
    const match = relativeTimeUnits.find(unit => absSeconds >= unit.seconds) || relativeTimeUnits[relativeTimeUnits.length - 1];

    return relativeTimeFormatter.format(Math.round(seconds / match.seconds), match.unit);
}
</script>
