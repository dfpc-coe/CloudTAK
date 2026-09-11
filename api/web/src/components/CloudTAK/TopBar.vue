<template>
    <div
        class='position-absolute d-flex align-items-center cloudtak-top-bar'
        :class='compact ? "cloudtak-panel px-2" : "cloudtak-top-bar--split"'
    >
        <div
            class='d-flex align-items-center cloudtak-top-bar-section'
            :class='compact ? "flex-grow-1" : "cloudtak-panel px-2"'
            style='min-width: 0;'
        >
            <ActiveMission :compact='compact' />
        </div>

        <div
            class='d-flex align-items-center flex-shrink-0 cloudtak-top-bar-section'
            :class='{ "cloudtak-panel px-2": !compact }'
        >
            <div
                v-if='compact'
                class='border-start mx-1'
                style='height: 32px;'
            />

            <TablerDropdown>
                <TablerIconButton
                    id='map-notifications'
                    title='Notifications Icon'
                    class='cloudtak-hover'
                    :class='{ "alert-pulse": alertNotifications }'
                    :hover='false'
                >
                    <IconAlertTriangle
                        v-if='alertNotifications'
                        :size='40'
                        stroke='1'
                        class='text-danger'
                    />
                    <IconBell
                        v-else
                        :size='40'
                        stroke='1'
                    />
                </TablerIconButton>
                <template #dropdown>
                    <Notifications />
                </template>
            </TablerDropdown>

            <span
                v-if='notifications'
                class='badge bg-red mb-2'
            />
            <span
                v-else
                style='width: 10px;'
            />

            <DrawTools />

            <div
                class='border-start mx-1'
                style='height: 32px;'
            />

            <TablerIconButton
                v-if='!menuShown'
                title='Open Menu'
                class='ms-1 cloudtak-hover'
                :hover='false'
                @click='router.push("/menu")'
            >
                <IconMenu2
                    :size='40'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-else
                title='Close Menu'
                class='ms-1 cloudtak-hover'
                :hover='false'
                @click='router.push("/")'
            >
                <IconX
                    :size='40'
                    stroke='1'
                />
            </TablerIconButton>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { from } from 'rxjs';
import { liveQuery } from 'dexie';
import { useObservable } from '@vueuse/rxjs';
import { TablerIconButton, TablerDropdown } from '@tak-ps/vue-tabler';
import {
    IconAlertTriangle,
    IconMenu2,
    IconBell,
    IconX,
} from '@tabler/icons-vue';
import ActiveMission from './ActiveMission.vue';
import Notifications from './Notifications.vue';
import DrawTools from './DrawTools.vue';
import TAKNotification, { NotificationType } from '../../base/notification.ts';
import { useAppStore } from '../../stores/app.ts';

defineProps<{
    menuShown: boolean;
}>();

const router = useRouter();
const appStore = useAppStore();

const compact = computed(() => appStore.isMobileDetected);

const notifications = useObservable<number>(
    from(liveQuery(async () => {
        return await TAKNotification.count()
    }))
);

const alertNotifications = useObservable<number>(
    from(liveQuery(async () => {
        return await TAKNotification.countByType(NotificationType.Alert)
    }))
);
</script>

<style scoped>
.cloudtak-top-bar {
    z-index: 5;
    top: calc(8px + var(--status-bar-height, 0px));
    left: 8px;
    right: 8px;
    height: 60px;
}

/* Two floating panels with the map still interactive between them */
.cloudtak-top-bar--split {
    justify-content: space-between;
    pointer-events: none;
}

.cloudtak-top-bar--split .cloudtak-top-bar-section {
    height: 60px;
    pointer-events: auto;
}

@keyframes alert-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
}

.alert-pulse {
    animation: alert-pulse 1.2s ease-in-out infinite;
}
</style>
