<template>
    <div class='trail-actions'>
        <div
            v-if='!summary'
            class='small text-muted'
        >
            No trail yet. Turn on Live Trail or load history to start one.
        </div>
        <template v-else>
            <div class='d-flex align-items-start gap-2'>
                <IconRoute
                    :size='18'
                    stroke='1'
                    class='flex-shrink-0 mt-1'
                    :style='{ color: summary.color || "#ff0000" }'
                />
                <div class='small'>
                    <div
                        class='fw-semibold'
                        v-text='summary.callsign'
                    />
                    <div
                        class='text-muted'
                        v-text='summaryLabel(summary)'
                    />
                </div>
            </div>
            <div class='d-flex flex-wrap gap-2 mt-2'>
                <button
                    class='btn btn-sm'
                    :disabled='!summary.points'
                    @click.stop.prevent='zoom'
                >
                    <IconZoomPan
                        :size='16'
                        stroke='1'
                        class='me-1'
                    />Zoom
                </button>
                <button
                    class='btn btn-sm'
                    @click.stop.prevent='openHistory'
                >
                    <IconHistory
                        :size='16'
                        stroke='1'
                        class='me-1'
                    />History
                </button>
                <button
                    class='btn btn-sm btn-outline-danger'
                    @click.stop.prevent='emit("clear")'
                >
                    <IconTrash
                        :size='16'
                        stroke='1'
                        class='me-1'
                    />Clear Trail
                </button>
            </div>
            <div
                v-if='error'
                class='small text-danger mt-2'
                v-text='error'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
/**
 * What can be done with the breadcrumb trail of a CoT: frame it, find it in
 * the History menu and clear it. Trails are not map features any more, so this
 * is the only way to remove one from where it is seen (TAK.NZ-only). Clearing is
 * only requested here: the host shows the confirmation (TrailClearDialog), because
 * it has to outlive a dropdown that closes when the dialog is clicked.
 */
import { ref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { IconRoute, IconZoomPan, IconHistory, IconTrash } from '@tabler/icons-vue';
import { liveQuery } from '../../../database.ts';
import { useMapStore } from '../../../stores/map.ts';
import { trailSummary, zoomToTrail, summaryLabel, type TrailSummary } from '../../../base/trail.ts';

const props = defineProps<{
    uid: string
}>();

const emit = defineEmits<{
    clear: []
}>();

const router = useRouter();
const mapStore = useMapStore();

const summary = ref<TrailSummary | null>(null);
const error = ref<string | null>(null);

let subscription: { unsubscribe(): void } | undefined;

watch(() => props.uid, (uid) => {
    subscription?.unsubscribe();
    error.value = null;
    summary.value = null;

    subscription = liveQuery(() => trailSummary(uid)).subscribe({
        next: (value) => {
            summary.value = value;
        },
        error: (err: unknown) => {
            console.error('Trail summary subscription failed', err);
        },
    });
}, { immediate: true });

onBeforeUnmount(() => {
    subscription?.unsubscribe();
});

async function zoom(): Promise<void> {
    error.value = null;
    try {
        if (!await zoomToTrail(mapStore.map, props.uid)) error.value = 'This trail has no positions to show';
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err);
    }
}

async function openHistory(): Promise<void> {
    await router.push({ path: '/menu/history', query: { uid: props.uid } });
}

</script>
