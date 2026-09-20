<template>
    <div class='col-12'>
        <div class='d-flex align-items-center py-2 px-2 my-2 mx-2 rounded cloudtak-accent'>
            <IconCloudPin
                :size='32'
                stroke='1'
                class='flex-shrink-0'
            />
            <span class='ms-2 flex-shrink-0'>From:</span>
            <a
                class='mx-2 cursor-pointer text-truncate'
                :title='props.subscription.meta.name'
                @click='router.push(`/menu/missions/${props.subscription.meta.guid}`)'
                v-text='props.subscription.meta.name'
            />

            <div class='ms-auto d-flex align-items-center gap-1 flex-shrink-0'>
                <NotSyncedBadge
                    v-if='pending'
                    :error='pending.error'
                />

                <TablerBadge
                    v-if='readonly'
                    class='small d-flex align-items-center flex-shrink-0'
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
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { IconCloudPin, IconLock } from '@tabler/icons-vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import { liveQuery } from 'dexie';
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

const readonly = computed<boolean>(() => {
    return !props.subscription.role?.permissions.includes('MISSION_WRITE');
});
</script>
