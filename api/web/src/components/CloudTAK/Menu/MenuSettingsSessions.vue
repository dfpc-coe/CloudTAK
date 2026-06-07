<template>
    <MenuTemplate
        name='Login Sessions'
        :loading='loading'
    >
        <template #default>
            <LoginSessionsList
                v-if='username'
                :username='username'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import LoginSessionsList from '../../util/LoginSessionsList.vue';
import { server } from '../../../std.ts';

const loading = ref<boolean>(true);
const username = ref<string>('');

onMounted(async () => {
    const res = await server.GET('/api/login');
    if (res.error) throw new Error(res.error.message);
    username.value = res.data.email;
    loading.value = false;
});
</script>
