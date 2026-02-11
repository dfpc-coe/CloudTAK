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
                                        :src='logo'
                                        draggable='false'
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
import Config from '../base/config.ts';
import { ref, onMounted } from 'vue'
import {
    TablerLoading
} from '@tak-ps/vue-tabler'

const logo = ref('/CloudTAKLogo.svg');

onMounted(async () => {
    const config = await Config.list(['login::logo', 'login::brand::enabled', 'login::brand::logo']);

    if (config['login::brand::enabled'] !== 'disabled' && config['login::brand::logo']) {
        logo.value = config['login::brand::logo'];
    } else if (config['login::logo']) {
        logo.value = config['login::logo'];
    }
})
</script>
