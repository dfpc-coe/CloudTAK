<template>
<div class='card-body'>
    <div class='d-flex justify-content-center' :class='{
        "mt-4 mb-2": !compact
    }'>
        <IconAlertTriangle v-if='compact' size='32' />
        <IconAlertTriangle v-else size='48'/>
    </div>

    <h3 class='pt-3 text-center' v-text='title'></h3>
    <div class='text-center' :class='{
        "mb-4 mt-2": !compact
    }'>
        <div><span v-text='err'/></div>
    </div>
</div>
</template>

<script>
import {
    IconAlertTriangle
} from '@tabler/icons-vue'

export default {
    name: 'Alert',
    props: {
        title: {
            type: String,
            default: 'Generic Error'
        },
        err: {
            type: String,
            default: 'Something is amiss'
        },
        compact: {
            type: Boolean,
            default: false
        },
    },
    components: {
        IconAlertTriangle
    }
}
</script>
