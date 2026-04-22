<template>
    <MenuTemplate
        name='Login Passkeys'
        :loading='loading'
        :none='!creating && !passkeys.items.length'
    >
        <template #buttons>
            <TablerIconButton
                title='New Passkey'
                @click='creating = true; newName = ""'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='fetch'
            />
        </template>
        <template #default>
            <div class='col-12 d-flex flex-column gap-2 py-3'>
                <div
                    v-if='creating'
                    class='d-flex align-items-center gap-2 px-2 py-2'
                >
                    <TablerInput
                        v-model='newName'
                        placeholder='Passkey Name'
                        :autofocus='true'
                        @keyup.enter='registerPasskey'
                        @keyup.escape='creating = false'
                    />
                    <button
                        class='btn btn-primary'
                        @click='registerPasskey'
                    >
                        Create
                    </button>
                </div>
                <template v-if='selected'>
                    <div class='d-flex align-items-center px-2 py-2'>
                        <TablerIconButton
                            title='Back to Passkeys'
                            @click='selected = null'
                        >
                            <IconArrowLeft
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <span class='fw-bold ms-2'>Passkey Details</span>
                        <div class='ms-auto'>
                            <TablerDelete
                                displaytype='icon'
                                @delete='deletePasskey'
                            />
                        </div>
                    </div>
                    <div class='row g-2'>
                        <div class='col-12'>
                            <label class='form-label'>Name</label>
                            <div v-text='selected.name || "Unnamed Passkey"' />
                        </div>
                        <div class='col-12'>
                            <label class='form-label'>Created</label>
                            <div v-text='new Date(selected.created).toLocaleString()' />
                        </div>
                        <div class='col-12'>
                            <label class='form-label'>Last Used</label>
                            <div v-text='selected.last_used ? new Date(selected.last_used).toLocaleString() : "Never"' />
                        </div>
                    </div>
                </template>
                <template v-else>
                    <StandardItem
                        v-for='p in passkeys.items'
                        :key='p.id'
                        @click='selected = p'
                    >
                        <div class='d-flex align-items-center px-2 py-2'>
                            <IconFingerprint
                                :size='32'
                                stroke='1'
                            />
                            <div class='ms-2 flex-grow-1'>
                                <div class='fw-bold'>
                                    {{ p.name || 'Unnamed Passkey' }}
                                </div>
                                <div class='text-muted small'>
                                    Created {{ new Date(p.created).toLocaleDateString() }}
                                    <template v-if='p.last_used'>
                                        &middot; Last used {{ new Date(p.last_used).toLocaleDateString() }}
                                    </template>
                                </div>
                            </div>
                        </div>
                    </StandardItem>
                </template>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import { server } from '../../../std.ts';
import type { Passkey, PasskeyList } from '../../../types.ts';
import { startRegistration } from '@simplewebauthn/browser';
import {
    TablerDelete,
    TablerIconButton,
    TablerInput,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconArrowLeft,
    IconPlus,
    IconFingerprint,
} from '@tabler/icons-vue';

const loading = ref<boolean>(true);
const creating = ref<boolean>(false);
const newName = ref<string>('');
const selected = ref<Passkey | null>(null);
const passkeys = ref<PasskeyList>({
    total: 0,
    items: []
});

onMounted(async () => {
    await fetch();
});

async function fetch(): Promise<void> {
    selected.value = null;
    loading.value = true;
    const res = await server.GET('/api/login/passkey');
    if (res.error) throw new Error(res.error.message);
    passkeys.value = res.data;
    loading.value = false;
}

async function registerPasskey(): Promise<void> {
    const name = newName.value.trim();
    if (!name) return;

    const res = await server.POST('/api/login/passkey/register/options');
    if (res.error) throw new Error(res.error.message);

    const credential = await startRegistration({ optionsJSON: res.data as unknown as Parameters<typeof startRegistration>[0]['optionsJSON'] });

    const regRes = await server.POST('/api/login/passkey/register', {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: { name, credential: credential as any },
    });
    if (regRes.error) throw new Error(regRes.error.message);

    creating.value = false;
    await fetch();
}

async function deletePasskey(): Promise<void> {
    if (!selected.value) return;
    const res = await server.DELETE('/api/login/passkey/{:id}', {
        params: { path: { ':id': selected.value.id } }
    });
    if (res.error) throw new Error(res.error.message);
    await fetch();
}
</script>
