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

                <div class='mt-3'>
                    <label class='form-label'>Scopes</label>
                    <TablerLoading
                        v-if='loading'
                        :inline='true'
                        desc='Loading Scopes'
                    />
                    <div
                        v-else
                        class='row g-2'
                    >
                        <div
                            v-for='scope in scopes'
                            :key='scope.resource'
                            class='col-12 col-md-6'
                        >
                            <div class='card'>
                                <div class='card-header py-2'>
                                    <code v-text='scope.resource' />
                                </div>
                                <div class='card-body py-2'>
                                    <TablerToggle
                                        v-for='level in scope.scopes'
                                        :key='level'
                                        v-model='editToken.permissions[level]'
                                        :label='level'
                                        :disabled='level !== `${scope.resource}:*` && editToken.permissions[`${scope.resource}:*`]'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
import { reactive, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { server } from '../../../std.ts';
import type { ETLScopeList } from '../../../types.ts';
import {
    TablerModal,
    TablerInput,
    TablerDelete,
    TablerToggle,
    TablerLoading,
} from '@tak-ps/vue-tabler';

type Token = { id: number; name: string; permissions: Array<string>; } | boolean;

const props = defineProps<{
    token: Token
}>();

const emit = defineEmits(['close', 'refresh']);

const route = useRoute();

const code = ref<string | boolean>(false);
const loading = ref(true);
const scopes = ref<ETLScopeList['items']>([]);

const editToken = reactive<{ id?: number; name: string; permissions: Record<string, boolean> }>({
    id: typeof props.token === 'object' ? props.token.id : undefined,
    name: typeof props.token === 'object' ? props.token.name : '',
    permissions: Object.fromEntries((typeof props.token === 'object' ? props.token.permissions : []).map((p) => [p, true])),
});

onMounted(async () => {
    const res = await server.GET('/api/scope');
    if (res.error) throw new Error(res.error.message);
    scopes.value = res.data.items;
    loading.value = false;
});

function body() {
    return {
        name: editToken.name,
        permissions: Object.keys(editToken.permissions).filter((scope) => editToken.permissions[scope]),
    };
}

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
            body: body()
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
            body: body()
        });

        if (res.error) throw new Error(res.error.message);

        code.value = res.data.token;
    }
};
</script>
