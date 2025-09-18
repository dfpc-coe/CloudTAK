<template>
    <div class='card mx-2 px-0'>
        <div class='card-body'>
            <TablerLoading
                v-if='loading.generate'
                desc='Generating Certificate'
            />
            <template v-else>
                <div class='col-12'>
                    <TablerInput
                        v-model='body.username'
                        icon='user'
                        label='Username'
                        @keyup.enter='generate'
                    />
                </div>
                <div class='col-12 mt-3'>
                    <TablerInput
                        v-model='body.password'
                        icon='lock'
                        label='Password'
                        type='password'
                        @keyup.enter='generate'
                    />
                </div>
            </template>
        </div>
        <div
            v-if='!loading.generate'
            class='card-footer'
        >
            <button
                class='cursor-pointer btn btn-primary w-100'
                @click='generate'
            >
                Generate Certificate
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { std } from '../../../std.ts';
import {
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';

const emit = defineEmits(['certs']);

const loading = reactive({
    generate: false
});

const body = reactive({
    username: '',
    password: '',
});

const generate = async () => {
    loading.generate = true;
    try {
        const res = await std('/api/marti/signClient', {
            method: 'POST',
            body: body
        });

        emit('certs', res);
    } catch (err) {
        loading.generate = false;
        throw err;
    }
};
</script>
