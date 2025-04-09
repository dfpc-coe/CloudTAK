<template>
    <div class='page page-center'>
        <div class='container container-normal py-4'>
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div class='card card-md'>
                            <div class='card-body'>
                                <div
                                    class='text-center'
                                    style='margin-bottom: 24px;'
                                >
                                    <img
                                        alt='Agency Logo'
                                        :src='config && config.logo ? config.logo : "/logo.png"'
                                        style='height: 150px;'
                                    >
                                </div>
                                <TablerLoading desc='Loading CloudTAK' />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { std } from '../std.js';
import { ref, onMounted } from 'vue'
import {
    TablerLoading
} from '@tak-ps/vue-tabler'

const config = ref<LoginConfig | undefined>();

onMounted(async () => {
    config.value = await std('/api/config/login') as LoginConfig;
})
</script>
