<template>
    <TablerModal>
        <div
            class='modal-body bg-white rounded'
        >
            <div
                class='text-center'
                style='margin-bottom: 24px;'
            >
                <img
                    src='/logo.png'
                    alt='Agency Logo'
                    height='150'
                >
            </div>
            <TablerLoading desc='Loading Map State' />
        </div>
    </TablerModal>
</template>

<script lang='ts'>
import {
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'CloudTAKLoading',
    components: {
        TablerModal,
        TablerLoading,
    },
}
</script>
