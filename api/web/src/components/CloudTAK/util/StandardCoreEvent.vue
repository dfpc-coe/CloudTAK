<template>
    <StandardItem @click='$emit("click")'>
        <div class='d-flex align-items-start gap-3 px-3 py-2'>
            <div
                v-if='icon'
                class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 mt-1 flex-shrink-0'
                style='width: 36px; height: 36px;'
            >
                <IconCalendarEvent
                    :size='18'
                    stroke='1.5'
                    :class='priorityClass'
                />
            </div>

            <div class='flex-grow-1 overflow-hidden'>
                <div class='d-flex align-items-center gap-2'>
                    <StatusDot
                        :status='event.ended ? "Unknown" : "Success"'
                        :title='event.ended ? "Ended" : "Active"'
                    />
                    <span class='fw-semibold text-truncate flex-grow-1'>{{ event.name }}</span>
                    <span
                        v-if='event.priority !== "none"'
                        class='badge flex-shrink-0 text-uppercase'
                        :class='priorityBadgeClass'
                    >{{ event.priority }}</span>
                </div>
                <div class='d-flex align-items-center gap-2 mt-1'>
                    <img
                        v-if='typeIcon'
                        :src='typeIcon'
                        alt='Event Type'
                        class='flex-shrink-0'
                        style='width: 40px; height: 40px; object-fit: contain;'
                    >
                    <div class='flex-grow-1 overflow-hidden'>
                        <div
                            v-if='event.location'
                            class='small d-flex align-items-center'
                            style='opacity: 0.85;'
                        >
                            <IconMapPin
                                :size='14'
                                stroke='1.5'
                                class='me-1 flex-shrink-0'
                            />
                            <span
                                class='text-truncate'
                                v-text='event.location'
                            />
                        </div>
                        <div class='text-muted small d-flex align-items-center'>
                            <IconClock
                                :size='14'
                                stroke='1.5'
                                class='me-1 flex-shrink-0'
                            />
                            {{ new Date(event.created).toLocaleString() }}
                        </div>
                        <div class='text-muted small text-truncate'>
                            {{ creator }}
                            <template v-if='event.ended'>
                                &middot; Ended {{ new Date(event.ended).toLocaleString() }}
                            </template>
                        </div>
                    </div>
                </div>
            </div>

            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import ms from 'milsymbol';
import Type2525 from '@tak-ps/node-cot/2525';
import { server } from '../../../std.ts';
import StandardItem from './StandardItem.vue';
import StatusDot from '../../util/StatusDot.vue';
import {
    IconClock,
    IconMapPin,
    IconCalendarEvent,
} from '@tabler/icons-vue';
import type { CoreEvent } from '../../../types.ts';

/**
 * Preconfigured Event Types are shared by every card on a page - fetch the
 * config once and let all StandardCoreEvent instances await the same promise
 */
let typePresets: Promise<Array<{ name: string; type: string; icon?: string }>> | undefined;

function loadTypePresets(): Promise<Array<{ name: string; type: string; icon?: string }>> {
    if (!typePresets) {
        typePresets = server.GET('/api/config', {
            params: {
                query: {
                    keys: 'core::event::types'
                }
            }
        }).then((res) => {
            if (res.error) throw new Error(res.error.message);
            return res.data['core::event::types'] || [];
        }).catch((err) => {
            // Clear the cache so a later card can retry the fetch
            typePresets = undefined;
            console.error('Failed to load Core Event Type config', err);
            return [];
        });
    }

    return typePresets;
}

const props = withDefaults(defineProps<{
    event: CoreEvent;
    icon?: boolean;
}>(), {
    icon: true,
});

defineEmits<{
    (e: 'click'): void;
}>();

const typeIcon = ref<string | undefined>();

watch(() => props.event.type, async (type) => {
    const icon = await resolveTypeIcon(type);

    // A card can be recycled onto another Event while the config loads
    if (props.event.type === type) typeIcon.value = icon;
}, { immediate: true });

/**
 * A custom icon on a matching preconfigured Event Type wins, otherwise
 * a numeric SIDC type renders its 2525E military symbol
 */
async function resolveTypeIcon(type: string): Promise<string | undefined> {
    if (!type) return undefined;

    const preset = (await loadTypePresets()).find((p) => p.type === type);
    if (preset && preset.icon) return preset.icon;

    if (Type2525.isNumericSIDCConvertable(type)) {
        return new ms.Symbol(type, { size: 24 }).toDataURL();
    }

    return undefined;
}

const creator = computed(() => {
    if (props.event.username) return props.event.username;
    if (props.event.connection !== null) return `Connection #${props.event.connection}`;
    return 'Unknown Creator';
});

const priorityClass = computed(() => {
    return {
        critical: 'text-danger',
        high: 'text-orange',
        medium: 'text-yellow',
        low: 'text-blue',
        none: 'text-secondary',
    }[props.event.priority] || 'text-secondary';
});

const priorityBadgeClass = computed(() => {
    return {
        critical: 'bg-red text-red-fg',
        high: 'bg-orange text-orange-fg',
        medium: 'bg-yellow text-yellow-fg',
        low: 'bg-blue text-blue-fg',
        none: 'bg-secondary text-secondary-fg',
    }[props.event.priority] || 'bg-secondary text-secondary-fg';
});
</script>
