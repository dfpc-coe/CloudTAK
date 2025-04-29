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
            <div class='modal-title'>Injector Editor</div>
        </div>

        <TablerLoading v-if='loading' />
        <div
            v-else
            class='modal-body row'
        >
            <div class='col-12'>
                <TablerInput
                    label='UID'
                    v-model='injector.uid'
                />
            </div>
            <div class='col-12'>
                <TablerInput
                    label='toInject'
                    v-model='injector.toInject'
                />
            </div>
        </div>
        <div class='modal-footer'>
            <button @click='saveInjector' class='btn btn-primary'>Save</button>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { std } from '../../../std.ts';
import type { Injector } from '../../../types.ts';
import {
    TablerModal,
    TablerInput,
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
        emit('close');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
