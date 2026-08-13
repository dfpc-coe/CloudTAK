<template>
    <div class='row g-0'>
        <div class='col-12 px-2 pb-2'>
            <div class='d-flex align-items-baseline'>
                <h2
                    class='mb-0'
                    v-text='capabilities.name'
                />
                <div
                    v-if='disabled'
                    class='ms-auto d-flex align-items-center text-secondary'
                >
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
        </div>

        <div
            v-if='!disabled'
            class='col-12'
        >
            <SlideDownHeader label='Compute'>
                <template #icon>
                    <IconCpu
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                </template>
                <template #right>
                    <div class='d-flex align-items-center text-secondary me-2'>
                        <IconCpu
                            :size='14'
                            stroke='1.5'
                        />
                        <span
                            class='ms-1 small'
                            v-text='`${settings.memory} MB`'
                        />
                        <span class='mx-2 opacity-50'>&middot;</span>
                        <IconClock2
                            :size='14'
                            stroke='1.5'
                        />
                        <span
                            class='ms-1 small'
                            v-text='`${settings.timeout}s`'
                        />
                    </div>
                </template>

                <div class='px-2 pt-2'>
                    <div class='row g-2'>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='settings.memory'
                                label='Memory (Mb)'
                                type='number'
                                min='128'
                                max='10240'
                                step='1'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='settings.timeout'
                                label='Timeout (s)'
                                type='number'
                                min='1'
                                max='900'
                                step='1'
                            />
                        </div>
                    </div>
                </div>
            </SlideDownHeader>
        </div>

        <div
            v-if='capabilities.permissions.length'
            class='col-12'
        >
            <SlideDownHeader
                label='Permissions'
                :model-value='true'
            >
                <template #icon>
                    <IconLock
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                </template>

                <div class='px-2 pt-2'>
                    <div
                        v-for='permission in capabilities.permissions'
                        :key='permission.resource'
                        class='mb-2'
                    >
                        <div
                            v-if='disabled'
                            class='d-flex align-items-baseline'
                        >
                            <code v-text='permission.resource' />
                            <span
                                v-if='permission.required'
                                class='ms-2 small text-red'
                            >required</span>
                        </div>
                        <TablerToggle
                            v-else
                            v-model='settings.permissions[permission.resource]'
                            :disabled='permission.required'
                            :label='permission.required ? `${permission.resource} (required)` : permission.resource'
                        />
                        <div
                            class='small text-secondary'
                            v-text='permission.description'
                        />
                    </div>
                </div>
            </SlideDownHeader>
        </div>

        <div
            v-if='disabled && (schedule || webhook)'
            class='col-12'
        >
            <SlideDownHeader
                label='Invocation'
                :model-value='true'
            >
                <template #icon>
                    <IconWorldDownload
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                </template>

                <div class='px-2 pt-2'>
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
                </div>
            </SlideDownHeader>
        </div>

        <div
            v-if='!disabled && capabilities.invocations.incoming'
            class='col-12'
        >
            <SlideDownHeader
                label='Incoming'
                :model-value='true'
            >
                <template #icon>
                    <IconWorldDownload
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                </template>

                <div class='px-2 pt-2'>
                    <TablerToggle
                        v-model='settings.incoming'
                        label='Create Incoming Config'
                    />
                    <template v-if='settings.incoming'>
                        <div
                            v-if='schedule'
                            class='ps-3'
                        >
                            <div class='d-flex align-items-center'>
                                <IconCalendarClock
                                    :size='20'
                                    stroke='1'
                                />
                                <div style='width: calc(100% - 20px);'>
                                    <TablerToggle
                                        v-model='settings.schedule'
                                        label='Scheduled Runs'
                                    />
                                </div>
                            </div>
                            <div
                                class='small text-secondary'
                                v-text='schedule.description'
                            />
                            <div
                                v-if='settings.schedule'
                                class='border rounded px-2 py-2 mt-2'
                            >
                                <ScheduleInput
                                    v-model='settings.cron'
                                />
                            </div>
                        </div>
                        <div
                            v-if='webhook'
                            class='ps-3'
                        >
                            <div class='d-flex align-items-center'>
                                <IconWebhook
                                    :size='20'
                                    stroke='1'
                                />
                                <div style='width: calc(100% - 20px);'>
                                    <TablerToggle
                                        v-model='settings.webhooks'
                                        label='Webhooks Delivery'
                                    />
                                </div>
                            </div>
                            <div
                                class='small text-secondary'
                                v-text='webhook.description'
                            />
                        </div>
                    </template>
                </div>
            </SlideDownHeader>
        </div>

        <div
            v-if='outgoing && outgoing.types.length'
            class='col-12'
        >
            <SlideDownHeader
                label='Outgoing'
                :model-value='true'
            >
                <template #icon>
                    <IconWorldUpload
                        :size='18'
                        stroke='1'
                        color='#6b7990'
                        class='ms-2 me-1'
                    />
                </template>

                <div class='px-2 pt-2'>
                    <TablerToggle
                        v-if='!disabled'
                        v-model='settings.outgoing'
                        label='Create Outgoing Config'
                    />
                    <div
                        v-for='type in outgoing.types'
                        :key='type.resource'
                        class='mb-2'
                        :class='{ "ps-3": !disabled }'
                    >
                        <code v-text='type.resource' />
                        <div
                            class='small text-secondary'
                            v-text='type.description'
                        />
                    </div>
                </div>
            </SlideDownHeader>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import type { ETLTaskCapabilities } from '../../../types.ts';
import type { CapabilitySettings } from '../../../base/capabilities.ts';
import {
    defaultCapabilitySettings,
    capabilitySettings,
} from '../../../base/capabilities.ts';
import ScheduleInput from '../../util/ScheduleInput.vue';
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import {
    TablerInput,
    TablerToggle,
} from '@tak-ps/vue-tabler';
import {
    IconCpu,
    IconLock,
    IconClock2,
    IconWebhook,
    IconCalendarClock,
    IconWorldDownload,
    IconWorldUpload,
} from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    capabilities: ETLTaskCapabilities;
    disabled?: boolean;
    modelValue?: CapabilitySettings;
}>(), {
    disabled: false,
    modelValue: undefined,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: CapabilitySettings): void;
}>();

const settings = ref<CapabilitySettings>(props.modelValue ?? defaultCapabilitySettings());

const schedule = computed(() => props.capabilities.invocations.incoming?.schedule);
const webhook = computed(() => props.capabilities.invocations.incoming?.webhook);
const outgoing = computed(() => props.capabilities.invocations.outgoing);

watch(() => props.modelValue, (value) => {
    if (value) settings.value = value;
});

// In edit mode the form owns seeding its values from the document's declared
// defaults - a new capabilities doc (task or version change) reseeds
watch(() => props.capabilities, () => {
    if (props.disabled) return;

    settings.value = capabilitySettings(props.capabilities);
    emit('update:modelValue', settings.value);
}, { immediate: true });
</script>
