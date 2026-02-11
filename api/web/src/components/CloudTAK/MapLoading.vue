<template>
    <TablerModal
        :fade='false'
    >
        <div
            class='modal-body rounded user-select-none'
        >
            <div
                class='text-center'
                style='margin-bottom: 24px;'
            >
                <img
                    alt='Agency Logo'
                    :src='logo'
                    style='height: 150px;'
                >
            </div>
            <TablerLoading desc='Loading Map State' />
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import Config from '../../base/config.ts';
import { ref, onMounted } from 'vue';
import {
    TablerModal,
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
});
</script>
