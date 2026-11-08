<template>
    <div class='d-flex align-items-center gap-2 flex-nowrap'>
        <TablerBadge
            v-if='active'
            background-color='rgba(47, 179, 68, 0.15)'
            border-color='rgba(47, 179, 68, 0.4)'
            text-color='#2fb344'
            :title='`Started ${new Date(started).toLocaleString()}`'
        >
            Active &middot; {{ elapsed }}
        </TablerBadge>
        <TablerBadge
            v-else
            background-color='rgba(107, 121, 144, 0.15)'
            border-color='rgba(107, 121, 144, 0.4)'
            text-color='#6b7990'
            :title='`Ended ${new Date(ended || started).toLocaleString()}`'
        >
            Ended &middot; {{ timediff(ended || started) }}
        </TablerBadge>

        <TablerBadge
            v-if='priority !== "none"'
            :background-color='badge.background'
            :border-color='badge.border'
            :text-color='badge.text'
        >
            {{ badge.label }}
        </TablerBadge>
    </div>
</template>

<script setup lang='ts'>
/** PropertyCoreEntityStatus - the at-a-glance state of a Core Event: active or ended with its age, and its priority */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import timediff from '../../../timediff';
import { priorityBadge } from '../../../utils/priority.ts';

const props = defineProps<{
    started: string;
    ended: string | null;
    priority: string;
}>();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    timer = setInterval(() => now.value = Date.now(), 30000);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
});

const active = computed(() => !props.ended || new Date(props.ended).getTime() > now.value);

const badge = computed(() => priorityBadge(props.priority));

/** Compact age of the Event - 45m, 13h, 2d 3h */
const elapsed = computed(() => {
    const minutes = Math.max(0, Math.floor((now.value - new Date(props.started).getTime()) / 60000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
});
</script>
