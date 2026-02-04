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
                <IconPencil :stroke='1' />
            </TablerIconButton>
            <div
                v-else-if='edit && isOpen'
                class='d-flex gap-1'
            >
                <TablerIconButton
                    color='blue'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy :stroke='1' />
                </TablerIconButton>
                <TablerIconButton
                    color='red'
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX :stroke='1' />
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
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup>
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import { validateURL } from '../../../base/validators.ts';
import {
    TablerLoading,
    TablerInput,
    TablerEnum,
    TablerIconButton,
    TablerAlert,
    TablerToggle
} from '@tak-ps/vue-tabler';
import UploadLogo from '../../util/UploadLogo.vue';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX
} from '@tabler/icons-vue';

const isOpen = ref(false);
const loading = ref(false);
const edit = ref(false);
const err = ref(null);

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
    err.value = null;
    try {
        const url = stdurl('/api/config');
        url.searchParams.append('keys', Object.keys(config.value).join(','));
        const res = await std(url);
        for (const key of Object.keys(config.value)) {
             if (res[key] !== undefined) config.value[key] = res[key];
        }
    } catch (error) {
        err.value = error;
    }
    loading.value = false;
}

async function save() {
    loading.value = true;
    err.value = null;
    try {
        await std(`/api/config`, {
            method: 'PUT',
            body: config.value
        });
        edit.value = false;
    } catch (error) {
        err.value = error
        console.error('Failed to save login config:', error);
    }
    loading.value = false;
}
</script>
