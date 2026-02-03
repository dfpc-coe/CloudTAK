<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Display Defaults'
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
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup>
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted, computed } from 'vue';
import { std } from '../../../std.ts';
import {
    TablerLoading,
    TablerEnum,
    TablerInlineAlert,
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
    err.value = null;
    config.value = {}; 
    displayOptions.value = {};
    try {
        const display = await std('/api/config/display');
        for (const [key, value] of Object.entries(display)) {
            displayOptions.value[key] = value.options;
            config.value[`display::${key}`] = value.value;
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
        
        await fetch();
    } catch (error) {
        err.value = error
        console.error('Failed to save Display config:', error);
        loading.value = false;
    }
}
</script>
