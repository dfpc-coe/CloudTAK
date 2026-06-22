<template>
    <TablerModal>
        <div class='modal-status bg-blue' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-header'>
            <div
                class='modal-title'
                v-text='"id" in source ? "Edit Paging Source" : "New Paging Source"'
            />
            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='"id" in source'
                    displaytype='icon'
                    @delete='deleteSource'
                />
            </div>
        </div>

        <!-- Step 1: Create / edit -->
        <template v-if='step === "edit"'>
            <div class='modal-body row g-3'>
                <div class='col-12'>
                    <label class='form-label'>Type</label>
                    <TablerEnum
                        v-model='editSource.type'
                        :disabled='"id" in source'
                        :options='typeOptions'
                    />
                </div>
                <div class='col-12'>
                    <TablerInput
                        v-model='editSource.value'
                        :label='valueLabel'
                        :placeholder='valuePlaceholder'
                    />
                </div>
                <div
                    v-if='"id" in source'
                    class='col-12'
                >
                    <div class='form-check form-switch'>
                        <input
                            id='paging-enabled'
                            v-model='editSource.enabled'
                            class='form-check-input'
                            type='checkbox'
                            :disabled='!source.verified'
                        >
                        <label
                            class='form-check-label'
                            for='paging-enabled'
                        >
                            {{ source.verified ? 'Enabled' : 'Verify source before enabling' }}
                        </label>
                    </div>
                </div>
            </div>
            <div class='modal-footer'>
                <button
                    v-if='"id" in source && !source.verified'
                    class='btn btn-secondary me-auto'
                    @click='resendCode'
                >
                    Resend Code
                </button>
                <button
                    v-if='"id" in source && !source.verified'
                    class='btn btn-warning'
                    @click='step = "verify"'
                >
                    Enter Verification Code
                </button>
                <button
                    class='btn btn-primary'
                    @click='saveSource'
                >
                    Save
                </button>
            </div>
        </template>

        <!-- Step 2: Enter verification code (new sources only, shown after creation) -->
        <template v-else-if='step === "verify"'>
            <div class='modal-body row g-3'>
                <div class='col-12'>
                    <p class='text-muted small mb-3'>
                        A 6-digit code was sent to <strong>{{ editSource.value }}</strong>.
                        Enter it below to verify ownership.
                    </p>
                    <TablerInput
                        v-model='verifyCodeInput'
                        label='Verification Code'
                        placeholder='000000'
                        :maxlength='6'
                        @keyup.enter='submitVerify'
                    />
                </div>
            </div>
            <div class='modal-footer'>
                <button
                    class='btn btn-secondary'
                    @click='step = "edit"'
                >
                    Back
                </button>
                <button
                    class='btn btn-primary'
                    @click='submitVerify'
                >
                    Verify
                </button>
            </div>
        </template>

        <!-- Step 3: Verified confirmation -->
        <template v-else-if='step === "verified"'>
            <div class='modal-body row g-3'>
                <div class='col-12 text-center py-3'>
                    <IconCircleCheck
                        :size='48'
                        stroke='1'
                        class='text-success'
                    />
                    <div class='mt-2 fw-bold'>
                        Source verified successfully!
                    </div>
                </div>
            </div>
            <div class='modal-footer'>
                <button
                    class='btn btn-primary'
                    @click='$emit("refresh")'
                >
                    Close
                </button>
            </div>
        </template>
    </TablerModal>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { server } from '../../../../std.ts';
import type { ProfilePaging, ProfilePaging_Create } from '../../../../types.ts';
import {
    TablerModal,
    TablerInput,
    TablerEnum,
    TablerDelete,
} from '@tak-ps/vue-tabler';
import { IconCircleCheck } from '@tabler/icons-vue';

type Step = 'edit' | 'verify' | 'verified';

const props = defineProps<{
    source: ProfilePaging | Record<string, never>;
}>();

const emit = defineEmits(['close', 'refresh']);

const step = ref<Step>('edit');
const verifyCodeInput = ref<string>('');

const editSource = reactive<{
    type: ProfilePaging_Create['type'];
    value: string;
    enabled: boolean;
}>(
    'id' in props.source
        ? {
            type: props.source.type as ProfilePaging_Create['type'],
            value: props.source.value,
            enabled: props.source.enabled,
        }
        : {
            type: 'sms',
            value: '',
            enabled: false,
        }
);

// The ID of the created/edited source (set after POST for verification flow)
const createdId = ref<number | null>('id' in props.source ? props.source.id : null);

const typeOptions = [
    { label: 'SMS', value: 'sms' },
    { label: 'Email', value: 'email' },
    { label: 'Push', value: 'push' },
];

const valueLabel = computed(() => {
    if (editSource.type === 'sms') return 'Phone Number';
    if (editSource.type === 'email') return 'Email Address';
    return 'Device Token';
});

const valuePlaceholder = computed(() => {
    if (editSource.type === 'sms') return '+1 (555) 000-0000';
    if (editSource.type === 'email') return 'you@example.com';
    return 'FCM device token';
});

async function saveSource() {
    if ('id' in props.source) {
        const id = props.source.id;
        const res = await server.PATCH('/api/profile/paging/{:pagingid}', {
            params: { path: { ':pagingid': id } },
            body: {
                enabled: editSource.enabled,
                value: editSource.value !== props.source.value ? editSource.value : undefined,
            }
        });
        if (res.error) throw new Error(res.error.message);
        emit('refresh');
    } else {
        const res = await server.POST('/api/profile/paging', {
            body: {
                type: editSource.type,
                value: editSource.value,
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
