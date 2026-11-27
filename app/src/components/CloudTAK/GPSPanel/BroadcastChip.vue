<template>
    <div
        v-if='mapStore.standbyFor'
        class='broadcast-chip cloudtak-panel d-flex align-items-center gap-2'
        data-test='broadcast-chip'
        @click.stop
    >
        <span
            class='flex-grow-1 text-truncate'
            data-test='broadcast-chip-text'
            :title='text'
            v-text='text'
        />
        <button
            type='button'
            class='btn btn-sm btn-info flex-shrink-0 broadcast-chip-action'
            :disabled='!hasPosition || claiming'
            :title='hasPosition ? undefined : "Set your location first"'
            data-test='broadcast-chip-action'
            @click.stop='claim'
        >
            <span
                v-if='claiming'
                class='spinner-border spinner-border-sm me-1 broadcast-chip-spinner'
                role='status'
                data-test='broadcast-chip-pending'
            />
            Take over
        </button>
    </div>
</template>

<script setup lang='ts'>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { LocationState } from '../../../utils/events.ts';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

const CLAIM_TIMEOUT_MS = 10000;

const claiming = ref(false);
let claimTimer: ReturnType<typeof setTimeout> | undefined;

function claim(): void {
    claiming.value = true;
    void mapStore.worker.conn.claimBroadcast();

    clearTimeout(claimTimer);
    claimTimer = setTimeout(() => { claiming.value = false; }, CLAIM_TIMEOUT_MS);
}

watch(() => mapStore.standbyFor, () => {
    claiming.value = false;
    clearTimeout(claimTimer);
});

onBeforeUnmount(() => clearTimeout(claimTimer));

const text = computed(() => `Shared from ${mapStore.standbyFor}`);

const hasPosition = computed(() => {
    return mapStore.location === LocationState.Live || mapStore.location === LocationState.Preset;
});
</script>

<style scoped>
.broadcast-chip {
    position: absolute;
    left: 0;
    bottom: calc(100% + 6px);
    width: 100%;
    height: 36px;
    padding: 0.2rem 0.3rem 0.2rem 0.6rem;
    font-size: 0.75rem;
    line-height: 1.2;
    border: 1px solid var(--tblr-info, #4dabf7);
    border-radius: 8px;
}

.broadcast-chip-action {
    padding: 0.1rem 0.5rem;
    font-size: 0.75rem;
}

.broadcast-chip-spinner {
    width: 0.7rem;
    height: 0.7rem;
    border-width: 1.5px;
}
</style>
