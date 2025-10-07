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
                v-text='token.id ? "Edit Token" : "New Token"'
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

<script setup>
import { ref } from 'vue';
import { std } from '/src/std.ts';
import {
    TablerModal,
    TablerInput,
    TablerDelete
} from '@tak-ps/vue-tabler'

const props = defineProps({
    token: {
        type: Object,
        required: true
    }
});

const emit = defineEmits([
    'close',
    'refresh'
]);

const code = ref(false);
const editToken = ref(props.token.id ? JSON.parse(JSON.stringify(props.token)) : { name: '' });

async function deleteToken() {
    await std(`/api/profile/token/${props.token.id}`, {
        method: 'DELETE',
    });

    emit('refresh');
}

async function saveToken() {
    if (props.token.id) {
        await std(`/api/profile/token/${props.token.id}`, {
            method: 'PATCH',
            body: editToken.value
        });
        emit('refresh');
    } else {
        const newtoken = await std('/api/profile/token', {
            method: 'POST',
            body: editToken.value
        });

        code.value = newtoken.token;
    }
}
</script>
