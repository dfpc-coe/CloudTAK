<template>
    <TablerModal>
        <div
            class='modal-body bg-white rounded user-select-none'
        >
            <div
                class='text-center'
                style='margin-bottom: 24px;'
            >
                <img
                    alt='Agency Logo'
                    :src='brandStore.login && brandStore.login.logo ? brandStore.login.logo : "/CloduTAKLogo.svg"'
                    style='height: 150px;'
                >
            </div>
            <TablerLoading desc='Loading Map State' />
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { useBrandStore } from '../../stores/brand.ts';
import {
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler'

const brandStore = useBrandStore();
</script>
