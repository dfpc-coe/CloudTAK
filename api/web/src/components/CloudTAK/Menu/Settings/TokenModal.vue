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
            <div
                class='modal-title'
                v-text='"id" in token ? "Edit Token" : "New Token"'
            />

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='editToken.id'
                    displaytype='icon'
                    @delete='deleteToken'
                />
            </div>
        </div>

        <div class='modal-body row'>
            <div
                v-if='!code'
                class='col-12'
            >
                <TablerInput
                    v-model='editToken.name'
                    label='Token Name'
                    @keyup.enter='saveToken'
                />
            </div>
            <div
                v-else
                class='col-12'
            >
                <pre v-text='code' />
            </div>
        </div>
        <div class='modal-footer'>
            <button
                v-if='!code'
                class='btn btn-primary'
                @click='saveToken'
            >
                Save
            </button>
            <button
                v-else
                class='btn btn-primary'
                @click='$emit("refresh")'
            >
                Close
            </button>
        </div>
    </TablerModal>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { server } from '../../../../std.ts';
import type { ProfileToken } from '../../../../types.ts';
import {
    TablerModal,
    TablerInput,
    TablerDelete
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    token: ProfileToken | Record<string, never>;
}>();

const emit = defineEmits(['close', 'refresh']);

const code = ref<string | false>(false);
const editToken = reactive<{ id?: number; name: string }>(
    'id' in props.token
        ? JSON.parse(JSON.stringify(props.token))
        : { name: '' }
);

async function deleteToken() {
    if (!('id' in props.token)) return;

    const res = await server.DELETE('/api/profile/token/{:id}', {
        params: { path: { ':id': props.token.id } }
    });

    if (res.error) throw new Error(res.error.message);

    emit('refresh');
}

async function saveToken() {
    if ('id' in props.token) {
        const res = await server.PATCH('/api/profile/token/{:id}', {
            params: { path: { ':id': props.token.id } },
            body: { name: editToken.name }
        });

        if (res.error) throw new Error(res.error.message);

        emit('refresh');
    } else {
        const res = await server.POST('/api/profile/token', {
            body: { name: editToken.name }
        });

        if (res.error) throw new Error(res.error.message);

        code.value = res.data.token;
    }
}
</script>
