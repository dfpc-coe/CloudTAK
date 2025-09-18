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
                v-text='token && typeof token === "object" && token.id ? "Edit Token" : "New Token"'
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
import { useRoute } from 'vue-router';
import { server } from '../../../std.ts';
import {
    TablerModal,
    TablerInput,
    TablerDelete
} from '@tak-ps/vue-tabler';

type Token = { id: number; name: string; } | boolean;

const props = defineProps<{
    token: Token
}>();

const emit = defineEmits(['close', 'refresh']);

const route = useRoute();

const code = ref<string | boolean>(false);

const editToken = reactive(
    props.token === true
        ? { name: '' }
        : JSON.parse(JSON.stringify(props.token))
);

const deleteToken = async () => {
    if (typeof props.token === 'object' && props.token.id) {
        const res = await server.DELETE(`/api/connection/{:connectionid}/token/{:id}`, {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid),
                    ':id': Number(props.token.id)
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        emit('refresh');
    }
};

const saveToken = async () => {
    if (typeof props.token === 'object' && props.token.id) {
        const res = await server.PATCH(`/api/connection/{:connectionid}/token/{:id}`, {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid),
                    ':id': Number(props.token.id)
                }
            },
            body: editToken
        });

        if (res.error) throw new Error(res.error.message);

        emit('refresh');
    } else {
        const res = await server.POST(`/api/connection/{:connectionid}/token`, {
            params: {
                path: {
                    ':connectionid': Number(route.params.connectionid)
                }
            },
            body: editToken
        });

        if (res.error) throw new Error(res.error.message);

        code.value = res.data.token;
    }
};
</script>
