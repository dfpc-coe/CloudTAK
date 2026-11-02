<template>
    <StandardItem
        class='core-row w-100 d-flex flex-row gap-3 align-items-center px-2 py-2'
        @click='$emit("click")'
    >
        <span
            v-if='icon'
            class='position-relative flex-shrink-0 d-inline-flex'
            :title='event.type'
        >
            <img
                v-if='typeIcon'
                :src='typeIcon'
                alt='Event Type'
                style='width: 36px; height: 36px; object-fit: contain;'
            >
            <span
                v-else
                class='avatar avatar-sm rounded-circle core-row__icon'
            >
                <IconCalendarEvent
                    :size='20'
                    stroke='1.5'
                    :class='priorityClass'
                />
            </span>
            <span
                class='core-row__status position-absolute rounded-circle'
                :class='event.active ? "bg-green" : "bg-dark"'
                :title='event.active ? "Active" : "Ended"'
            />
        </span>

        <div
            class='flex-grow-1 d-flex flex-column'
            style='min-width: 0;'
        >
            <span class='d-flex align-items-center gap-2'>
                <StatusDot
                    v-if='!icon'
                    :status='event.active ? "Success" : "Unknown"'
                    :title='event.active ? "Active" : "Ended"'
                />
                <span
                    class='fw-semibold text-truncate'
                    v-text='event.name'
                />
            </span>
            <span
                class='text-secondary small text-truncate'
                v-text='subtitle'
            />
        </div>

        <span
            v-if='event.priority !== "none"'
            class='badge flex-shrink-0 text-uppercase'
            :class='priorityBadgeClass'
            v-text='event.priority'
        />

        <slot name='actions' />
    </StandardItem>
</template>

<script lang='ts'>
import { symbolDataURL } from '../../../utils/milsymbol.ts';
import Type2525 from '@tak-ps/node-cot/2525';
import { server } from '../../../std.ts';

/**
 * Preconfigured Event Types are shared by every card on a page - fetch the
 * config once at module scope and let all StandardCoreEntity instances await
 * the same promise
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

/**
 * A custom icon on a matching preconfigured Event Type wins, otherwise
 * a numeric SIDC type renders its 2525E military symbol
 *
 * The preset lookup stays uncached so a failed config fetch can still be retried
 */
async function resolveTypeIcon(type: string): Promise<string | undefined> {
    if (!type) return undefined;

    const preset = (await loadTypePresets()).find((p) => p.type === type);
    if (preset && preset.icon) return preset.icon;

    if (Type2525.isNumericSIDCConvertable(type)) {
        return symbolDataURL(type);
    }

    return undefined;
}

export default {
    name: 'StandardCoreEntity'
};
</script>

<script setup lang='ts'>
import { computed, ref, watch } from 'vue';
import StandardItem from './StandardItem.vue';
import StatusDot from '../../util/StatusDot.vue';
import { IconCalendarEvent } from '@tabler/icons-vue';
import type { CoreEntity } from '../../../types.ts';
import timediff from '../../../timediff';

const props = withDefaults(defineProps<{
    event: CoreEntity;
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

const creator = computed(() => {
    if (props.event.username) return props.event.username;
    if (props.event.connection !== null) return `Connection #${props.event.connection}`;
    return 'Unknown Creator';
});

const subtitle = computed(() => {
    const when = props.event.ended && !props.event.active
        ? `Ended ${timediff(props.event.ended)}`
        : props.event.ended && props.event.active
            ? `Ends ${timediff(props.event.ended)}`
            : timediff(props.event.created);

    return [props.event.location, creator.value, when].filter(Boolean).join(' · ');
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

<style scoped>
.core-row__icon {
    --tblr-avatar-size: 2.25rem;
    color: var(--tblr-body-color);
    background-color: var(--cloudtak-inset-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--cloudtak-inset-border, rgba(255, 255, 255, 0.12));
    transition: border-color 0.15s ease, color 0.15s ease;
}

.core-row:hover .core-row__icon,
.core-row:focus-within .core-row__icon {
    border-color: rgba(var(--tblr-primary-rgb), 0.4);
}

.core-row__status {
    width: 10px;
    height: 10px;
    right: -2px;
    bottom: -2px;
    border: 2px solid var(--standard-item-bg, rgba(0, 0, 0, 0.35));
    box-sizing: content-box;
}
</style>
