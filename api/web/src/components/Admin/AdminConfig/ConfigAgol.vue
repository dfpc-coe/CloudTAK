<template>
    <div class='col-lg-12 hover py-2 d-flex align-items-center' :class="{ 'cursor-pointer': !edit }">
        <div class="d-flex align-items-center flex-grow-1" @click="isOpen = !isOpen">
            <IconChevronDown v-if="isOpen" />
            <IconChevronRight v-else />
            <span class='mx-2 user-select-none'>ArcGIS Online</span>
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
import {
    TablerLoading,
    TablerInput,
    TablerToggle,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconChevronRight,
    IconChevronDown,
    IconPencil
} from '@tabler/icons-vue';

const isOpen = ref(false);
const loading = ref(false);
const edit = ref(false);

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
    edit.value = false;
    try {
        const url = stdurl('/api/config');
        url.searchParams.append('keys', Object.keys(config.value).join(','));
        const res = await std(url);
        for (const key of Object.keys(config.value)) {
             if (res[key] !== undefined) config.value[key] = res[key];
        }
    } catch (error) {
        console.error('Failed to load AGOL config:', error);
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
        console.error('Failed to save AGOL config:', error);
    }
    loading.value = false;
}
</script>
