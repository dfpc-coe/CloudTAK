<template>
    <div class='col-12 d-flex align-items-center py-2 px-2 text-muted'>
        <IconInfoSquareRounded
            size='32'
            class='mx-2'
        />
        <div>
            <span v-text='label' /> are only shown if the channel in which they belong is turned on
        </div>
    </div>
</template>
<script>
import {
    IconInfoSquareRounded
} from '@tabler/icons-vue';

export default {
    name: 'ChannelInfo',
    components: {
        IconInfoSquareRounded
    },
    props: {
        label: {
            type: String,
            default: 'Missions'
        }
    }
}
</script>
