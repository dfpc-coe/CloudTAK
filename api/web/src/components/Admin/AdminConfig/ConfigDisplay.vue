<template>
    <div class='col-lg-12 hover py-2 d-flex align-items-center' :class="{ 'cursor-pointer': !edit }">
        <div class="d-flex align-items-center flex-grow-1" @click="isOpen = !isOpen">
            <IconChevronDown v-if="isOpen" />
            <IconChevronRight v-else />
            <span class='mx-2 user-select-none'>Display Defaults</span>
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
                <TablerInlineAlert
                    title='Application Behavior'
                    description='These are the default display settings for new users. Existing users will not be affected.'
                />

                <div
                    v-for='key in displayKeys'
                    :key='key'
                    class='col-lg-12'
                >
                    <TablerEnum
                        v-model='config[key]'
                        :label='key.replace("display::", "") === "icon_rotation" ? "Rotate Icons with Course" : key.replace("display::", "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())'
                        :options='displayOptions[key.replace("display::", "")] || []'
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
import { ref, watch, onMounted, computed } from 'vue';
import { std } from '../../../std.ts';
import {
    TablerLoading,
    TablerEnum,
    TablerInlineAlert,
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

const config = ref({});
const displayOptions = ref({});

const displayKeys = computed(() => Object.keys(config.value).filter(k => k.startsWith('display::')));

onMounted(() => {
     if (isOpen.value) fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) fetch();
});

async function fetch() {
    loading.value = true;
    edit.value = false;
    config.value = {}; 
    displayOptions.value = {};
    try {
        const display = await std('/api/config/display');
        for (const [key, value] of Object.entries(display)) {
            displayOptions.value[key] = value.options;
            config.value[`display::${key}`] = value.value;
        }
    } catch (error) {
        console.error('Failed to load Display config:', error);
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
        
        await fetch();
    } catch (error) {
        console.error('Failed to save Display config:', error);
        loading.value = false;
    }
}
</script>
