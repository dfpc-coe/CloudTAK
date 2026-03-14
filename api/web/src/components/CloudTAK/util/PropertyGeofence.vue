<template>
    <div class='col-12 pt-2'>
        <SlideDownHeader
            v-model='expanded'
            label='Geofence'
        >
            <template #icon>
                <IconFence
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <div class='mx-2 py-2'>
                <div class='rounded bg-accent px-2 py-2 user-select-none'>
                    <div class='row g-2'>
                        <div class='col-12'>
                            <TablerToggle
                                label='Elevation Monitored'
                                :model-value='geofence.elevationMonitored ?? false'
                                :disabled='true'
                            />
                        </div>

                        <div
                            v-if='geofence.trigger === "Both" || geofence.trigger === "Enter"'
                            class='col-6 py-2 d-flex align-items-center'
                        >
                            <IconDoorEnter
                                :size='32'
                                stroke='1'
                                class='mx-2'
                            />
                            <span>Alarm on Enter</span>
                        </div>
                        <div
                            v-if='geofence.trigger === "Both" || geofence.trigger === "Exit"'
                            class='col-6 py-2 d-flex align-items-center'
                        >
                            <IconDoorExit
                                :size='32'
                                stroke='1'
                                class='mx-2'
                            />
                            <span>Alarm on Exit</span>
                        </div>
                    </div>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import SlideDownHeader from './SlideDownHeader.vue';
import { IconFence, IconDoorEnter, IconDoorExit } from '@tabler/icons-vue';
import { TablerToggle } from '@tak-ps/vue-tabler';

defineProps<{
    geofence: {
        elevationMonitored?: boolean;
        tracking?: boolean;
        trigger?: string;
    }
}>();

const expanded = ref(false);
</script>
