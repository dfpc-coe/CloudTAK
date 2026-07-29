<template>
    <div class='col-12'>
        <IconActivity
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label
            class='subheader user-select-none'
            v-text='"Status"'
        />
        <div class='mx-2 pt-1 d-flex align-items-center'>
            <TablerBadge
                v-if='props.active'
                background-color='rgba(47, 179, 68, 0.15)'
                border-color='rgba(47, 179, 68, 0.4)'
                text-color='#2fb344'
            >
                Active
            </TablerBadge>
            <TablerBadge
                v-else
                background-color='rgba(107, 121, 144, 0.15)'
                border-color='rgba(107, 121, 144, 0.4)'
                text-color='#6b7990'
            >
                Ended
            </TablerBadge>

            <span
                v-if='!props.active && props.ended'
                class='mx-2 text-muted cursor-pointer'
                @click='relative = !relative'
                v-text='relative ? timediff(props.ended) : props.ended'
            />

            <div
                v-if='props.edit'
                class='ms-auto'
            >
                <TablerIconButton
                    :title='props.active ? "End Event" : "Reactivate Event"'
                    @click='emit("update:active", !props.active)'
                >
                    <IconPlayerStop
                        v-if='props.active'
                        :size='20'
                        stroke='1'
                    />
                    <IconPlayerPlay
                        v-else
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { TablerBadge, TablerIconButton } from '@tak-ps/vue-tabler';
import { IconActivity, IconPlayerStop, IconPlayerPlay } from '@tabler/icons-vue';
import timediff from '../../../timediff';

const props = defineProps<{
    active: boolean;
    /** Time at which the Event ended */
    ended: string | null;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:active', value: boolean): void
}>();

const relative = ref(true);
</script>
