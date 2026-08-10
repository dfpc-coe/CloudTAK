<template>
    <div>
        <div class='d-flex align-items-baseline'>
            <h2
                class='mb-0'
                v-text='capabilities.name'
            />
            <div class='ms-auto d-flex align-items-center text-secondary'>
                <IconCpu
                    :size='14'
                    stroke='1.5'
                />
                <span
                    class='ms-1 small'
                    v-text='`${capabilities.compute.memory} MB`'
                />
                <span class='mx-2 opacity-50'>&middot;</span>
                <IconClock2
                    :size='14'
                    stroke='1.5'
                />
                <span
                    class='ms-1 small'
                    v-text='`${capabilities.compute.timeout}s`'
                />
            </div>
        </div>
        <p
            class='text-secondary mt-1 mb-0'
            v-text='capabilities.description'
        />

        <template v-if='capabilities.permissions.length'>
            <div class='subheader mt-4 mb-2'>
                Permissions
            </div>
            <div
                v-for='permission in capabilities.permissions'
                :key='permission.resource'
                class='mb-2'
            >
                <div class='d-flex align-items-baseline'>
                    <code v-text='permission.resource' />
                    <span
                        v-if='permission.required'
                        class='ms-2 small text-red'
                    >required</span>
                </div>
                <div
                    class='small text-secondary'
                    v-text='permission.description'
                />
            </div>
        </template>

        <template v-if='schedule || webhook'>
            <div class='subheader mt-4 mb-2'>
                Invocation
            </div>
            <div
                v-if='schedule'
                class='mb-2'
            >
                <div class='d-flex align-items-center'>
                    <IconCalendarClock
                        :size='16'
                        stroke='1.5'
                        class='text-secondary'
                    />
                    <span class='ms-2'>Scheduled</span>
                    <code
                        class='ms-2'
                        v-text='schedule.default.schedule'
                    />
                    <span
                        class='ms-auto small text-secondary'
                        v-text='schedule.default.enabled ? "on by default" : "off by default"'
                    />
                </div>
                <div
                    class='small text-secondary'
                    v-text='schedule.description'
                />
            </div>
            <div
                v-if='webhook'
                class='mb-2'
            >
                <div class='d-flex align-items-center'>
                    <IconWebhook
                        :size='16'
                        stroke='1.5'
                        class='text-secondary'
                    />
                    <span class='ms-2'>Webhook</span>
                    <span
                        class='ms-auto small text-secondary'
                        v-text='webhook.default.enabled ? "on by default" : "off by default"'
                    />
                </div>
                <div
                    class='small text-secondary'
                    v-text='webhook.description'
                />
            </div>
        </template>

        <template v-if='outgoing && outgoing.types.length'>
            <div class='subheader mt-4 mb-2'>
                Outgoing
            </div>
            <div
                v-for='type in outgoing.types'
                :key='type.resource'
                class='mb-2'
            >
                <code v-text='type.resource' />
                <div
                    class='small text-secondary'
                    v-text='type.description'
                />
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import type { ETLTaskCapabilities } from '../../../types.ts';
import {
    IconCpu,
    IconClock2,
    IconWebhook,
    IconCalendarClock
} from '@tabler/icons-vue';

const props = defineProps<{
    capabilities: ETLTaskCapabilities
}>();

const schedule = computed(() => props.capabilities.invocations.incoming?.schedule);
const webhook = computed(() => props.capabilities.invocations.incoming?.webhook);
const outgoing = computed(() => props.capabilities.invocations.outgoing);
</script>
