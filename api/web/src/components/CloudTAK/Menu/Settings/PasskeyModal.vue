<template>
    <TablerModal>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-header'>
            <div class='modal-title'>
                Passkey Details
            </div>
            <div class='ms-auto btn-list'>
                <TablerDelete
                    displaytype='icon'
                    @delete='deletePasskey'
                />
            </div>
        </div>
        <div class='modal-body row g-2'>
            <div class='col-12'>
                <label class='form-label'>Name</label>
                <div v-text='passkey.name || "Unnamed Passkey"' />
            </div>
            <div class='col-12'>
                <label class='form-label'>Created</label>
                <div v-text='new Date(passkey.created).toLocaleString()' />
            </div>
            <div class='col-12'>
                <label class='form-label'>Last Used</label>
                <div v-text='passkey.last_used ? new Date(passkey.last_used).toLocaleString() : "Never"' />
            </div>
        </div>
        <div class='modal-footer'>
            <button
                class='btn btn-primary'
                @click='$emit("close")'
            >
                Close
            </button>
        </div>
    </TablerModal>
</template>

<script setup lang="ts">
import { std } from '../../../../std.ts';
import {
    TablerModal,
    TablerDelete,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    passkey: {
        id: number;
        name: string;
        credential_id: string;
        created: string;
        last_used: string | null;
    };
}>();

const emit = defineEmits(['close', 'refresh']);

async function deletePasskey() {
    await std(`/api/login/passkey/${encodeURIComponent(props.passkey.id)}`, {
        method: 'DELETE',
    });

    emit('refresh');
}
</script>
