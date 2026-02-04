<template>
    <SlideDownHeader
        v-model='isOpen'
        label='COTAK OAuth Provider'
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
                            v-model='config[`provider::url`]'
                            label='Provider URL'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config[`provider::secret`]'
                            label='Provider Secret'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config[`provider::client`]'
                            label='Provider Client'
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
import {
    TablerLoading,
    TablerInput,
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
    'provider::url': '',
    'provider::secret': '',
    'provider::client': '',
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
        console.error('Failed to save Provider config:', error);
    }
    loading.value = false;
}
</script>
