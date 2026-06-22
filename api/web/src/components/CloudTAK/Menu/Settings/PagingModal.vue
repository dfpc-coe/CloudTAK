<template>
    <TablerModal>
        <div
            class='modal-status'
            :class='accentClass'
        />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-header d-flex align-items-center gap-2'>
            <div
                class='paging-icon flex-shrink-0'
                :style='`background: ${meta.tint};`'
            >
                <component
                    :is='meta.icon'
                    :size='22'
                    stroke='1.5'
                    :class='meta.iconClass'
                />
            </div>
            <div
                class='modal-title'
                v-text='isEdit ? `Edit ${meta.label}` : `New ${meta.label}`'
            />
            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='isEdit'
                    displaytype='icon'
                    @delete='deleteSource'
                />
            </div>
        </div>

        <!-- Step 1: Create / edit -->
        <template v-if='step === "edit"'>
            <div class='modal-body row g-3'>
                <div class='col-12'>
                    <TablerInput
                        v-model='value'
                        :type='meta.inputType'
                        :label='meta.valueLabel'
                        :placeholder='meta.placeholder'
                        @keyup.enter='saveSource'
                    />
                </div>

                <div
                    v-if='isEdit'
                    class='col-12'
                >
                    <div
                        class='paging-status-row d-flex align-items-center gap-2 px-3 py-2'
                    >
                        <template v-if='verified'>
                            <IconCircleCheck
                                :size='20'
                                stroke='1.5'
                                class='text-green'
                            />
                            <span class='small'>This source is verified</span>
                        </template>
                        <template v-else>
                            <IconAlertCircle
                                :size='20'
                                stroke='1.5'
                                class='text-yellow'
                            />
                            <span class='small'>Pending verification</span>
                            <button
                                class='btn btn-sm btn-warning ms-auto'
                                @click='step = "verify"'
                            >
                                Enter Code
                            </button>
                        </template>
                    </div>
                </div>

                <div
                    v-if='isEdit && verified'
                    class='col-12'
                >
                    <label class='paging-toggle d-flex align-items-center gap-2 px-3 py-2 m-0'>
                        <span class='form-check form-switch m-0'>
                            <input
                                v-model='enabled'
                                class='form-check-input'
                                type='checkbox'
                            >
                        </span>
                        <span class='fw-bold'>Enabled</span>
                        <span class='text-secondary small ms-auto'>
                            {{ enabled ? 'Receiving pages' : 'Paused' }}
                        </span>
                    </label>
                </div>
            </div>
            <div class='modal-footer'>
                <button
                    v-if='isEdit && !verified'
                    class='btn btn-link text-secondary me-auto'
                    @click='resendCode'
                >
                    Resend Code
                </button>
                <button
                    class='btn btn-primary'
                    :disabled='!value'
                    @click='saveSource'
                >
                    Save
                </button>
            </div>
        </template>

        <!-- Step 2: Enter verification code -->
        <template v-else-if='step === "verify"'>
            <div class='modal-body'>
                <div class='text-center mb-3'>
                    <div
                        class='paging-icon mx-auto mb-2'
                        :style='`background: ${meta.tint};`'
                    >
                        <component
                            :is='meta.icon'
                            :size='24'
                            stroke='1.5'
                            :class='meta.iconClass'
                        />
                    </div>
                    <p class='text-secondary small mb-0'>
                        Enter the 6-digit code sent to
                    </p>
                    <p class='fw-bold mb-0 text-break'>
                        {{ value }}
                    </p>
                </div>
                <TablerInput
                    v-model='verifyCodeInput'
                    placeholder='000000'
                    autocomplete='one-time-code'
                    inputmode='numeric'
                    class='paging-code-input'
                    :maxlength='6'
                    @keyup.enter='submitVerify'
                />
            </div>
            <div class='modal-footer'>
                <button
                    class='btn btn-link text-secondary me-auto'
                    @click='resendCode'
                >
                    Resend Code
                </button>
                <button
                    class='btn btn-primary'
                    :disabled='verifyCodeInput.length !== 6'
                    @click='submitVerify'
                >
                    Verify
                </button>
            </div>
        </template>

        <!-- Step 3: Verified confirmation -->
        <template v-else-if='step === "verified"'>
            <div class='modal-body'>
                <div class='text-center py-4'>
                    <IconCircleCheck
                        :size='56'
                        stroke='1.5'
                        class='text-green'
                    />
                    <div class='mt-3 fw-bold fs-3'>
                        Verified!
                    </div>
                    <div class='text-secondary small mt-1'>
                        {{ value }} is ready to receive pages.
                    </div>
                </div>
            </div>
            <div class='modal-footer'>
                <button
                    class='btn btn-primary w-100'
                    @click='$emit("refresh")'
                >
                    Done
                </button>
            </div>
        </template>
    </TablerModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { server } from '../../../../std.ts';
import type { ProfilePaging, ProfilePaging_Create } from '../../../../types.ts';
import {
    TablerModal,
    TablerInput,
    TablerDelete,
} from '@tak-ps/vue-tabler';
import {
    IconCircleCheck,
    IconAlertCircle,
    IconMessage,
    IconMail,
} from '@tabler/icons-vue';

type Step = 'edit' | 'verify' | 'verified';
type PagingType = ProfilePaging_Create['type'];

const props = defineProps<{
    source: ProfilePaging | { type: PagingType };
}>();

const emit = defineEmits(['close', 'refresh']);

const isEdit = computed((): boolean => 'id' in props.source);
const type = computed((): PagingType => props.source.type as PagingType);
const verified = computed((): boolean => 'verified' in props.source ? props.source.verified : false);

const step = ref<Step>('edit');
const verifyCodeInput = ref<string>('');
const value = ref<string>('value' in props.source ? props.source.value : '');
const enabled = ref<boolean>('enabled' in props.source ? props.source.enabled : false);

// The ID of the created/edited source (set after POST for the verification flow)
const createdId = ref<number | null>('id' in props.source ? props.source.id : null);

const TYPE_META: Record<Exclude<PagingType, 'push'>, {
    label: string;
    valueLabel: string;
    placeholder: string;
    inputType: string;
    icon: typeof IconMessage;
    iconClass: string;
    tint: string;
    accent: string;
}> = {
    sms: {
        label: 'SMS Notification',
        valueLabel: 'Phone Number',
        placeholder: '+1 (555) 000-0000',
        inputType: 'tel',
        icon: IconMessage,
        iconClass: 'text-blue',
        tint: 'rgba(32, 107, 196, 0.15)',
        accent: 'bg-blue',
    },
    email: {
        label: 'Email Notification',
        valueLabel: 'Email Address',
        placeholder: 'you@example.com',
        inputType: 'email',
        icon: IconMail,
        iconClass: 'text-green',
        tint: 'rgba(63, 182, 139, 0.15)',
        accent: 'bg-green',
    },
};

const meta = computed(() => TYPE_META[type.value as Exclude<PagingType, 'push'>] ?? TYPE_META.sms);
const accentClass = computed(() => meta.value.accent);

async function saveSource() {
    if (!value.value) return;

    if (isEdit.value && 'id' in props.source) {
        const valueChanged = value.value !== props.source.value;
        const res = await server.PATCH('/api/profile/paging/{:pagingid}', {
            params: { path: { ':pagingid': props.source.id } },
            body: {
                enabled: enabled.value,
                value: valueChanged ? value.value : undefined,
            }
        });
        if (res.error) throw new Error(res.error.message);

        if (valueChanged) {
            // Updating the value resets verification — guide the user to re-verify
            step.value = 'verify';
            return;
        }

        emit('refresh');
    } else {
        const res = await server.POST('/api/profile/paging', {
            body: {
                type: type.value,
                value: value.value,
            }
        });
        if (res.error) throw new Error(res.error.message);
        createdId.value = res.data.id;
        step.value = 'verify';
    }
}

async function submitVerify() {
    if (!createdId.value || verifyCodeInput.value.length !== 6) return;

    const res = await server.POST('/api/profile/paging/{:pagingid}/verify', {
        params: { path: { ':pagingid': createdId.value } },
        body: { code: verifyCodeInput.value }
    });

    if (res.error) throw new Error(res.error.message);
    step.value = 'verified';
}

async function resendCode() {
    if (!createdId.value) return;
    const res = await server.POST('/api/profile/paging/{:pagingid}/resend', {
        params: { path: { ':pagingid': createdId.value } },
    });
    if (res.error) throw new Error(res.error.message);
}

async function deleteSource() {
    if (!('id' in props.source)) return;

    const res = await server.DELETE('/api/profile/paging/{:pagingid}', {
        params: { path: { ':pagingid': props.source.id } }
    });

    if (res.error) throw new Error(res.error.message);
    emit('refresh');
}
</script>

<style scoped>
.paging-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
}

.paging-status-row,
.paging-toggle {
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    background-color: rgba(0, 0, 0, 0.18);
    cursor: pointer;
}

[data-bs-theme='light'] .paging-status-row,
[data-bs-theme='light'] .paging-toggle {
    border-color: rgba(var(--tblr-primary-rgb), 0.16);
    background-color: rgba(255, 255, 255, 0.5);
}

.paging-code-input :deep(input) {
    text-align: center;
    letter-spacing: 0.5em;
    font-size: 1.5rem;
    font-weight: 600;
}
</style>
