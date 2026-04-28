<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Login Page'
    >
        <template #right>
            <TablerIconButton
                v-if='!edit && isOpen'
                title='Edit'
                @click.stop='edit = true'
            >
                <IconPencil stroke='1' />
            </TablerIconButton>
            <div
                v-else-if='edit && isOpen'
                class='d-flex gap-1'
            >
                <TablerIconButton
                    color='rgba(var(--tblr-primary-rgb), 0.14)'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy
                        color='rgb(var(--tblr-primary-rgb))'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX stroke='1' />
                </TablerIconButton>
            </div>
        </template>
        <div class='col-lg-12 py-2 px-2 border rounded'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />
                <div class='row'>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config["login::name"]'
                            :disabled='!edit'
                            label='Login Page Title'
                            placeholder='CloudTAK'
                        />

                        <TablerInput
                            v-model='config["login::signup"]'
                            :disabled='!edit'
                            :error='validateURL(config["login::signup"])'
                            label='TAK Server Signup Link'
                        />

                        <TablerInput
                            v-model='config["login::forgot"]'
                            :disabled='!edit'
                            :error='validateURL(config["login::forgot"])'
                            label='TAK Server Password Reset Link'
                        />

                        <TablerInput
                            v-model='config["login::username"]'
                            :disabled='!edit'
                            label='Username Label'
                            desc='Label for the username field on the login page ie: Email, Callsign, etc.'
                        />

                        <UploadLogo
                            v-model='config["login::logo"]'
                            label='Login Logo'
                            :disabled='!edit'
                        />

                        <TablerEnum
                            v-model='config["login::brand::enabled"]'
                            :disabled='!edit'
                            label='Enable Large Brand Logo'
                            :options='[
                                "default",
                                "enabled",
                                "disabled"
                            ]'
                        />

                        <UploadLogo
                            v-if='config["login::brand::enabled"] === "enabled"'
                            v-model='config["login::brand::logo"]'
                            label='Large Brand Logo'
                            :disabled='!edit'
                        />

                        <TablerToggle
                            v-model='config["login::background::enabled"]'
                            label='Enable Custom Background'
                            :disabled='!edit'
                        />
                        <TablerInput
                            v-if='config["login::background::enabled"]'
                            v-model='config["login::background::color"]'
                            type='color'
                            label='Background Colour'
                            :disabled='!edit'
                        />

                        <TablerToggle
                            v-model='config["oidc::enabled"]'
                            class='mt-3'
                            label='Enable OIDC SSO'
                            :disabled='!edit'
                        />

                        <template v-if='config["oidc::enabled"]'>
                            <TablerInlineAlert
                                class='mt-2 mb-2'
                                title='Beta Feature'
                                description='OIDC SSO is currently in beta and may not be fully functional.'
                                severity='warning'
                            />
                            <TablerToggle
                                v-model='config["oidc::enforced"]'
                                label='Enforce SSO (Disable Username/Password Login)'
                                :disabled='!edit'
                            />
                            <TablerInput
                                v-model='config["oidc::name"]'
                                label='Provider Name'
                                placeholder='SSO'
                                :disabled='!edit'
                            />
                            <TablerInput
                                v-model='config["oidc::discovery"]'
                                label='OIDC Discovery URL'
                                placeholder='https://...'
                                :disabled='!edit'
                            />
                            <TablerInput
                                v-model='config["oidc::client"]'
                                label='Client ID'
                                :disabled='!edit'
                            />
                            <TablerInput
                                v-model='config["oidc::secret"]'
                                label='Client Secret'
                                type='password'
                                autocomplete='new-password'
                                :disabled='!edit'
                            />
                            <TablerInput
                                v-model='config["oidc::redirect"]'
                                label='Redirect URI'
                                placeholder='/api/auth/callback'
                                :disabled='!edit'
                            />
                            <TablerInput
                                v-model='config["oidc::scopes"]'
                                label='Scopes'
                                placeholder='openid profile email'
                                :disabled='!edit'
                            />
                            <UploadLogo
                                v-model='config["oidc::logo"]'
                                label='OIDC Logo'
                                :disabled='!edit'
                            />
                        </template>

                        <TablerToggle
                            v-model='config["passkey::enabled"]'
                            class='mt-3'
                            label='Enable Passkey Authentication'
                            :disabled='!edit'
                        />
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import { validateURL } from '../../../base/validators.ts';
import {
    TablerLoading,
    TablerInput,
    TablerEnum,
    TablerIconButton,
    TablerAlert,
    TablerInlineAlert,
    TablerToggle
} from '@tak-ps/vue-tabler';
import UploadLogo from '../../util/UploadLogo.vue';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX
} from '@tabler/icons-vue';

interface LoginConfig {
    'login::name': string;
    'login::logo': string;
    'login::forgot': string;
    'login::signup': string;
    'login::username': string;
    'login::brand::enabled': 'default' | 'enabled' | 'disabled';
    'login::brand::logo': string;
    'login::background::enabled': boolean;
    'login::background::color': string;
    'oidc::enabled': boolean;
    'oidc::enforced': boolean;
    'oidc::name': string;
    'oidc::client': string;
    'oidc::secret': string;
    'oidc::discovery': string;
    'oidc::redirect': string;
    'oidc::scopes': string;
    'oidc::logo': string;
    'passkey::enabled': boolean;
}

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<LoginConfig>({
    'login::name': '',
    'login::logo': '',
    'login::forgot': '',
    'login::signup': '',
    'login::username': 'Username or Email',
    'login::brand::enabled': 'default',
    'login::brand::logo': '',
    'login::background::enabled': false,
    'login::background::color': '#000000',
    'oidc::enabled': false,
    'oidc::enforced': false,
    'oidc::name': '',
    'oidc::client': '',
    'oidc::secret': '',
    'oidc::discovery': '',
    'oidc::redirect': '',
    'oidc::scopes': '',
    'oidc::logo': '',
    'passkey::enabled': true,
});

onMounted(() => {
    // Optional: fetch on mount if we want to preload, or fetch on open
     if (isOpen.value) void fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) void fetch();
});

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        const { data, error } = await server.GET('/api/config', {
            params: {
                query: {
                    keys: Object.keys(config.value).join(',')
                }
            }
        });
        if (error) throw new Error(error.message);

        config.value = {
            'login::name': data['login::name'] ?? '',
            'login::logo': data['login::logo'] ?? '',
            'login::forgot': data['login::forgot'] ?? '',
            'login::signup': data['login::signup'] ?? '',
            'login::username': data['login::username'] ?? 'Username or Email',
            'login::brand::enabled': data['login::brand::enabled'] ?? 'default',
            'login::brand::logo': data['login::brand::logo'] ?? '',
            'login::background::enabled': data['login::background::enabled'] ?? false,
            'login::background::color': data['login::background::color'] ?? '#000000',
            'oidc::enabled': data['oidc::enabled'] ?? false,
            'oidc::enforced': data['oidc::enforced'] ?? false,
            'oidc::name': data['oidc::name'] ?? '',
            'oidc::client': data['oidc::client'] ?? '',
            'oidc::secret': data['oidc::secret'] ?? '',
            'oidc::discovery': data['oidc::discovery'] ?? '',
            'oidc::redirect': data['oidc::redirect'] ?? '',
            'oidc::scopes': data['oidc::scopes'] ?? '',
            'oidc::logo': data['oidc::logo'] ?? '',
            'passkey::enabled': data['passkey::enabled'] ?? true,
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}

async function save(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        const { error } = await server.PUT('/api/config', {
            body: config.value
        });
        if (error) throw new Error(error.message);

        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save login config:', error);
    }
    loading.value = false;
}
</script>
