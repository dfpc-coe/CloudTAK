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

            <TablerBadge
                v-if='readonly'
                class='ms-auto small d-flex align-items-center flex-shrink-0'
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
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { IconCloudPin, IconLock } from '@tabler/icons-vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import type Subscription from '../../../base/subscription.ts';

const props = defineProps<{
    /** The Mission Subscription the CoT originates from */
    subscription: Subscription
}>();

const router = useRouter();

const readonly = computed<boolean>(() => {
    return !props.subscription.role?.permissions.includes('MISSION_WRITE');
});
</script>
