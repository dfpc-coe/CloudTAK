<template>
    <div class='col-lg-12 hover py-2 d-flex align-items-center' :class="{ 'cursor-pointer': !edit }">
        <div class="d-flex align-items-center flex-grow-1" @click="isOpen = !isOpen">
            <IconChevronDown v-if="isOpen" />
            <IconChevronRight v-else />
            <span class='mx-2 user-select-none'>Login Page</span>
        </div>
        <div class='ms-auto' v-if="!edit && isOpen">
             <TablerIconButton title="Edit" @click="edit = true">
                <IconPencil />
             </TablerIconButton>
        </div>
    </div>

    <div v-if="isOpen" class='col-lg-12 py-2 border rounded'>
        <TablerLoading v-if="loading" />
        <template v-else>
            <div class="row">
                <div class='col-lg-12'>
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
                        label='Enable Background Image'
                        :disabled='!edit'
                    />
                    <TablerInput
                        v-model='config["login::background::color"]'
                        type='color'
                        label='Background Colour'
                        :disabled='!edit'
                    />
                </div>
            </div>
            <div class='col-lg-12 d-flex py-2' v-if="edit">
                <div class='btn' @click='fetch'>Cancel</div>
                <div class='ms-auto'>
                    <div class='btn btn-primary' @click='save'>Save Settings</div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import { validateURL } from '../../../base/validators.ts';
import {
    TablerLoading,
    TablerInput,
    TablerEnum,
    TablerColour,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import UploadLogo from '../../util/UploadLogo.vue';
import {
    IconChevronRight,
    IconChevronDown,
    IconPencil
} from '@tabler/icons-vue';

const isOpen = ref(false);
const loading = ref(false);
const edit = ref(false);

const config = ref({
    'login::logo': '',
    'login::forgot': '',
    'login::signup': '',
    'login::username': 'Username or Email',
    'login::brand::enabled': 'default',
    'login::brand::logo': '',
    'login::background::enabled': false,
    'login::background::color': '#000000',
});

onMounted(() => {
    // Optional: fetch on mount if we want to preload, or fetch on open
     if (isOpen.value) fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) fetch();
});

async function fetch() {
    loading.value = true;
    edit.value = false;
    try {
        const url = stdurl('/api/config');
        url.searchParams.append('keys', Object.keys(config.value).join(','));
        const res = await std(url);
        for (const key of Object.keys(config.value)) {
             if (res[key] !== undefined) config.value[key] = res[key];
        }
    } catch (error) {
        console.error('Failed to load login config:', error);
    }
    loading.value = false;
}

async function save() {
    loading.value = true;
    try {
        await std(`/api/config`, {
            method: 'PUT',
            body: config.value
        });
        edit.value = false;
    } catch (error) {
        console.error('Failed to save login config:', error);
    }
    loading.value = false;
}
</script>
