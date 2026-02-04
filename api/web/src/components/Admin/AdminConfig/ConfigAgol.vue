<template>
    <SlideDownHeader
        v-model='isOpen'
        label='ArcGIS Online'
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
                        <TablerToggle
                            v-model='config["agol::enabled"]'
                            :disabled='!edit'
                            label='ArcGIS Online Enabled'
                        />

                        <template v-if='config["agol::enabled"]'>
                            <div
                                class='px-2 py-2 round btn-group w-100'
                                role='group'
                            >
                                <input
                                    id='agol-oauth2'
                                    type='radio'
                                    class='btn-check'
                                    autocomplete='off'
                                    :checked='config["agol::auth_method"] === "oauth2"'
                                    :disabled='config["agol::enabled"] === false || !edit'
                                    @click='config["agol::auth_method"] = "oauth2"'
                                >
                                <label
                                    for='agol-oauth2'
                                    type='button'
                                    class='btn'
                                >OAuth2</label>

                                <input
                                    id='agol-legacy'
                                    type='radio'
                                    class='btn-check'
                                    autocomplete='off'
                                    :checked='config["agol::auth_method"] === "legacy"'
                                    :disabled='config["agol::enabled"] === false || !edit'
                                    @click='config["agol::auth_method"] = "legacy"'
                                >
                                <label
                                    for='agol-legacy'
                                    type='button'
                                    class='btn'
                                >Legacy</label>
                            </div>

                            <template v-if='config["agol::auth_method"] === "oauth2"'>
                                <TablerInput
                                    v-model='config["agol::client_id"]'
                                    :disabled='!edit'
                                    label='OAuth2 Client ID'
                                    description='Client ID from your ArcGIS Location Platform or ArcGIS Enterprise account'
                                />
                                <TablerInput
                                    v-model='config["agol::client_secret"]'
                                    type='password'
                                    :disabled='!edit'
                                    label='OAuth2 Client Secret'
                                    description='Client Secret from your ArcGIS Location Platform or ArcGIS Enterprise account'
                                />
                            </template>
                            <template v-else>
                                <TablerInput
                                    v-model='config["agol::token"]'
                                    type='password'
                                    :disabled='!edit'
                                    label='Legacy Token'
                                    description='ArcGIS Online access token'
                                />
                            </template>
                        </template>
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
import {
    TablerLoading,
    TablerInput,
    TablerToggle,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
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
    'agol::enabled': false,
    'agol::auth_method': 'oauth2',
    'agol::token': '',
    'agol::client_id': '',
    'agol::client_secret': '',
});

onMounted(() => {
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
        console.error('Failed to save AGOL config:', error);
    }
    loading.value = false;
}
</script>
