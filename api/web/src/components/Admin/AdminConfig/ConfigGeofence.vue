<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Geofence Server'
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
                    color='blue'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy stroke='1' />
                </TablerIconButton>
                <TablerIconButton
                    color='red'
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
                        <TablerToggle
                            v-model='config["geofence::enabled"]'
                            :disabled='!edit'
                            label='Geofence Server Enabled'
                        />
                    </div>
                    <div
                        v-if='config["geofence::enabled"]'
                        class='col-lg-12'
                    >
                        <TablerInput
                            v-model='config["geofence::url"]'
                            :disabled='!edit'
                            :error='validateURL(config["geofence::url"] as string)'
                            label='Geofence Server URL'
                        />
                        <TablerInput
                            v-model='config["geofence::password"]'
                            type='password'
                            :disabled='!edit'
                            label='Geofence Server Password'
                        />
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang='ts'>
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import { validateURL } from '../../../base/validators.ts';
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
const err = ref<Error | null>(null);

const config = ref<{
    'geofence::enabled': boolean;
    'geofence::url': string;
    'geofence::password': string;
}>({
    'geofence::enabled': false,
    'geofence::url': '',
    'geofence::password': '',
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
        const { data, error: reqError } = await server.GET('/api/config', {
            params: {
                query: {
                    keys: Object.keys(config.value).join(',')
                }
            }
        });

        if (reqError) throw new Error(reqError.message);

        config.value = data;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}

async function save() {
    loading.value = true;
    err.value = null;
    try {
        const { error: reqError } = await server.PUT('/api/config', {
            body: config.value
        });
        if (reqError) throw new Error(reqError.message);

        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Geofence config:', error);
    }
    loading.value = false;
}
</script>
