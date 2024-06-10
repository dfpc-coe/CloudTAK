<template>
    <div class='col-12 d-flex py-2 px-2 text-red justify-content-center'>
        <div class='d-flex align-items-center'>
            <IconAlertCircle
                size='32'
                stroke='2'
                class='mx-2'
            />
            <div>
                No Channels are selected
            </div>
        </div>
    </div>
</template>
<script>
import {
    IconAlertCircle
} from '@tabler/icons-vue';

export default {
    name: 'NoChannelsInfo',
    components: {
        IconAlertCircle
    },
}
</script>
