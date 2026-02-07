<template>
    <TablerModal>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header'>
            <div class='modal-title'>
                Injector Editor
            </div>

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='typeof props.injector !== "boolean"'
                    displaytype='icon'
                    @click='deleteInjector'
                />
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <div
            v-else
            class='modal-body row'
        >
            <div class='col-12'>
                <TablerInput
                    v-model='injector.uid'
                    label='UID'
                    :disabled='typeof props.injector !== "boolean"'
                />
            </div>
            <div class='col-12'>
                <TablerInput
                    v-model='injector.toInject'
                    label='toInject'
                    :disabled='typeof props.injector !== "boolean"'
                />
            </div>
        </div>
        <div class='modal-footer'>
            <button
                v-if='typeof props.injector === "boolean"'
                class='btn btn-primary'
                @click='saveInjector'
            >
                Save
            </button>
            <button
                v-else
                class='btn btn-primary'
                @click='emit("close")'
            >
                Close
            </button>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { std, stdurl } from '../../../std.ts';
import type { Injector } from '../../../types.ts';
import {
    TablerModal,
    TablerInput,
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler'

const props = defineProps<{
    injector: Injector | boolean
}>();

const emit = defineEmits([
    'close'
]);

const injector = ref<Injector>({
    uid: typeof props.injector === 'boolean' ? '' : props.injector.uid,
    toInject: typeof props.injector === 'boolean' ? '' : props.injector.toInject,
});

const loading = ref(false);

async function saveInjector() {
    loading.value = true;

    try {
        await std('/api/server/injector', {
            method: 'POST',
            body: injector.value
        })

        emit('close');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteInjector() {
    if (typeof props.injector === 'boolean') throw new Error('Cannot delete this injector');

    loading.value = true;

    try {
        const url = stdurl('/api/server/injector')
        url.searchParams.set('uid', props.injector.uid);
        url.searchParams.set('toInject', props.injector.toInject);

        await std(url, {
            method: 'DELETE'
        })

        emit('close');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
