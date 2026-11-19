<template>
    <div
        v-if='available'
        class='sharing-toggle'
    >
        <div
            role='button'
            tabindex='0'
            class='cloudtak-hover cursor-pointer d-flex'
            :class='{ "pe-none opacity-50": sharing.busy }'
            :title='label'
            :aria-label='label'
            :aria-pressed='sharing.paused'
            @click.stop.prevent='toggle'
            @keyup.enter='toggle'
        >
            <IconBroadcastOff
                v-if='sharing.paused'
                :size='32'
                stroke='1'
                class='text-warning'
            />
            <IconBroadcast
                v-else
                :size='32'
                stroke='1'
                class='text-green'
            />
        </div>
        <Teleport to='body'>
            <TablerModal
                v-if='confirming'
                size='sm'
                :dismissable='!sharing.busy'
                @close='close'
            >
                <div class='modal-status bg-warning' />
                <button
                    v-if='!sharing.busy'
                    type='button'
                    class='btn-close'
                    aria-label='Close'
                    @click='close'
                />
                <div class='modal-body text-body'>
                    <h3 class='modal-title mb-2'>
                        Pause sharing?
                    </h3>
                    <p class='mb-2'>
                        While paused, this device will:
                    </p>
                    <ul class='mb-2'>
                        <li>Stop sharing your location</li>
                        <li>Disconnect from the TAK server</li>
                        <li>Not receive alerts or notifications</li>
                    </ul>
                    <p class='text-muted mb-0'>
                        You stay paused, even after the app restarts, until you tap Resume.
                    </p>
                    <div
                        v-if='sharing.error'
                        class='alert alert-danger mt-3 mb-0'
                        role='alert'
                        v-text='sharing.error'
                    />
                </div>
                <div class='modal-footer'>
                    <button
                        type='button'
                        class='btn me-auto'
                        :disabled='sharing.busy'
                        @click='close'
                    >
                        {{ sharing.error ? 'Close' : 'Cancel' }}
                    </button>
                    <button
                        v-if='!sharing.paused'
                        type='button'
                        class='btn btn-warning'
                        :disabled='sharing.busy'
                        @click='pause'
                    >
                        {{ sharing.busy ? 'Pausing…' : 'Pause sharing' }}
                    </button>
                </div>
            </TablerModal>
        </Teleport>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import { IconBroadcast, IconBroadcastOff } from '@tabler/icons-vue';
import { TablerModal } from '@tak-ps/vue-tabler';
import { isNativePlatform } from '../../utils/capacitor.ts';
import { useSharingStore } from '../../stores/sharing.ts';

// Native app only: the web app has no use for it
const available = isNativePlatform();
const sharing = useSharingStore();
const confirming = ref(false);

const label = computed(() => sharing.paused ? 'Resume sharing' : 'Pause sharing');

async function toggle(): Promise<void> {
    if (sharing.busy) return;
    if (sharing.paused) {
        await sharing.resume();
        return;
    }
    sharing.error = null;
    confirming.value = true;
}

async function pause(): Promise<void> {
    await sharing.pause();
    // Stay open on a problem so the user can read it
    if (!sharing.error) confirming.value = false;
}

function close(): void {
    if (sharing.busy) return;
    confirming.value = false;
}
</script>
