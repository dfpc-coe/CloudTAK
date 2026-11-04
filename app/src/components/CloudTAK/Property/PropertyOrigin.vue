<template>
    <div class='d-flex align-items-center gap-2 mx-2 mt-2 px-2 py-1 rounded border cloudtak-accent small'>
        <IconCloudPin
            :size='18'
            stroke='1'
            class='flex-shrink-0'
        />
        <span class='text-secondary flex-shrink-0 user-select-none'>From</span>
        <a
            class='cursor-pointer text-truncate'
            :title='props.subscription.meta.name'
            @click='router.push(`/menu/missions/${props.subscription.meta.guid}`)'
            v-text='props.subscription.meta.name'
        />

        <div class='ms-auto d-flex align-items-center gap-1 flex-shrink-0'>
            <NotSyncedBadge
                v-if='pending'
                :error='pending.error'
                :loading='syncing'
                :retry='true'
                :class='{ "cursor-pointer": !syncing }'
                @click='sync'
            />

            <TablerBadge
                v-if='readonly'
                class='d-flex align-items-center flex-shrink-0'
                background-color='rgba(255, 171, 0, 0.15)'
                border-color='rgba(255, 171, 0, 0.35)'
                text-color='#c98500'
                title='Your role in this Mission does not allow editing this feature'
            >
                <IconLock
                    :size='14'
                    stroke='1'
                    class='me-1'
                />
                Read Only
            </TablerBadge>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { IconCloudPin, IconLock } from '@tabler/icons-vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import { liveQuery } from '../../../database.ts';
import { useObservable } from '@vueuse/rxjs';
import { from } from 'rxjs';
import NotSyncedBadge from '../util/NotSyncedBadge.vue';
import type Subscription from '../../../base/subscription.ts';
import type { DBSubscriptionFeature } from '../../../database.ts';

const props = defineProps<{
    /** The Mission Subscription the CoT originates from */
    subscription: Subscription
    /** The UID of the CoT being viewed */
    uid: string
}>();

const router = useRouter();

/** The local change to this CoT that has not been confirmed by the server */
const pending = useObservable<DBSubscriptionFeature | undefined>(
    from(liveQuery(async () => {
        return await props.subscription.feature.pendingFrom(props.uid);
    }))
);

const syncing = ref(false);

const readonly = computed<boolean>(() => {
    return !props.subscription.role?.permissions.includes('MISSION_WRITE');
});

async function sync(): Promise<void> {
    if (syncing.value) return;

    syncing.value = true;
    try {
        // Failures are recorded on the row, which the Not Synced badge surfaces
        // Held in a local as vue/no-mutating-props mistakes push() for Array.push
        const { feature } = props.subscription;
        await feature.push();
    } finally {
        syncing.value = false;
    }
}
</script>
