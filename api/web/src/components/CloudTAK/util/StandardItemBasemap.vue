<template>
    <StandardItem
        class='d-flex align-items-center'
    >
        <div class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 ms-2 my-2'>
            <component
                :is='resolvedIcon'
                :size='24'
                stroke='1'
            />
        </div>

        <div class='basemap-content ms-3 flex-grow-1'>
            <div class='basemap-title-row d-flex align-items-center gap-2'>
                <span class='fw-semibold flex-grow-1'>{{ basemap.name }}</span>
            </div>

            <div
                v-if='badges.length'
                class='basemap-badges d-flex flex-wrap gap-2 mt-2'
            >
                <template
                    v-for='badge in badges'
                    :key='badge.label'
                >
                    <TablerBadge
                        v-if='badge.kind === "frequency"'
                        class='rounded-pill small d-inline-flex align-items-center gap-1'
                        background-color='rgba(6, 182, 212, 0.2)'
                        border-color='rgba(6, 182, 212, 0.5)'
                        text-color='#0891b2'
                    >
                        <IconClock
                            :size='14'
                            stroke='1.75'
                        />
                        {{ badge.label }}
                    </TablerBadge>

                    <TablerBadge
                        v-else
                        :background-color='badge.tone === "primary" ? "rgba(36, 163, 255, 0.2)" : badge.tone === "neutral" ? "rgba(255, 255, 255, 0.1)" : "rgba(120, 120, 120, 0.2)"'
                        :border-color='badge.tone === "primary" ? "rgba(36, 163, 255, 0.9)" : badge.tone === "neutral" ? "rgba(255, 255, 255, 0.35)" : "rgba(120, 120, 120, 0.8)"'
                        :text-color='badge.tone === "primary" ? "#24a3ff" : badge.tone === "neutral" ? "#9ca3af" : "#6b7280"'
                        class='rounded-pill small'
                    >
                        {{ badge.label }}
                    </TablerBadge>
                </template>
            </div>
        </div>

        <div class='d-flex align-items-center gap-2 me-2 flex-nowrap action-container'>
            <TablerBadge
                :background-color='isPrivate ? "rgba(247, 161, 0, 0.2)" : "rgba(47, 179, 68, 0.2)"'
                :border-color='isPrivate ? "rgba(247, 161, 0, 0.5)" : "rgba(47, 179, 68, 0.5)"'
                :text-color='isPrivate ? "#f7a100" : "#2fb344"'
            >
                {{ isPrivate ? 'Private' : 'Public' }}
            </TablerBadge>

            <TablerBadge
                v-if='basemap.hidden'
                background-color='rgba(214, 57, 57, 0.2)'
                border-color='rgba(214, 57, 57, 0.5)'
                text-color='#d63939'
            >
                Hidden
            </TablerBadge>

            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import StandardItem from './StandardItem.vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import { BasemapTypeConfig } from '../Menu/Basemaps/types.ts';
import type { BasemapSourceType } from '../Menu/Basemaps/types.ts';
import type { Basemap } from '../../../types.ts';
import { computed } from 'vue';
import { IconGridDots, IconMap, IconVector, IconServer, IconClock } from '@tabler/icons-vue';

type BasemapBadgeTone = 'primary' | 'neutral' | 'muted';
type BasemapBadgeKind = 'default' | 'frequency';
type BasemapBadge = { label: string; tone: BasemapBadgeTone; kind?: BasemapBadgeKind };

const props = defineProps<{
    basemap: Basemap;
}>();

const isPrivate = computed(() => Boolean(props.basemap.username));

const badges = computed<BasemapBadge[]>(() => {
    const output: BasemapBadge[] = [];

    if (props.basemap.frequency) {
        output.push({
            label: formatFrequencySeconds(props.basemap.frequency),
            tone: 'primary',
            kind: 'frequency'
        });
    }

    return output;
});

const resolvedIcon = computed(() => {
    const normalizedType = String(props.basemap.type || '').toLowerCase();
    if (normalizedType === 'raster') return IconMap;
    if (normalizedType === 'vector') return IconVector;
    if (normalizedType) return IconServer;

    return protocolIcon(props.basemap.protocol);
});

function formatFrequencySeconds(value?: string | number | null) {
    if (value === undefined || value === null) return '';

    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return `${value}s`;

    const seconds = Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2).replace(/\.00$/, '').replace(/(\.[1-9])0$/, '$1');
    return `${seconds}s`;
}

function protocolIcon(protocol?: string) {
    if (protocol && protocol in BasemapTypeConfig) {
        return BasemapTypeConfig[protocol as BasemapSourceType].icon;
    }
    return IconGridDots;
}
</script>

<style scoped>
.icon-wrapper {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    min-height: 3rem;
    flex-shrink: 0;
}

.basemap-content {
    min-width: 0;
}

.basemap-title-row {
    min-width: 0;
}

.basemap-badge {
    font-size: 0.75rem;
    padding: 0.1rem 0.5rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.3);
}

.basemap-badge--primary {
    border-color: rgba(36, 163, 255, 0.9);
    background-color: rgba(36, 163, 255, 0.2);
}

.basemap-frequency-badge {
    color: inherit;
}

.basemap-badge--neutral {
    border-color: rgba(255, 255, 255, 0.35);
    background-color: rgba(255, 255, 255, 0.1);
}

.basemap-badge--muted {
    border-color: rgba(120, 120, 120, 0.8);
    background-color: rgba(120, 120, 120, 0.2);
}

.action-container {
    flex-shrink: 0;
}
</style>
