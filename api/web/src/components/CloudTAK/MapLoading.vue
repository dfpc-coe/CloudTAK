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
                    src='/logo.png'
                    alt='Agency Logo'
                    style='height: 150px;'
                >
            </div>
            <TablerLoading desc='Loading Map State' />
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import {
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler'
</script>
