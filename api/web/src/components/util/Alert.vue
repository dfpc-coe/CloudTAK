<template>
<div class='card-body'>
    <div class='d-flex justify-content-center' :class='{
        "mt-4 mb-2": !compact
    }'>
        <AlertTriangleIcon v-if='compact' width='32' height='32' />
        <AlertTriangleIcon v-else width='48' height='48' />
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
    AlertTriangleIcon
} from 'vue-tabler-icons'

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
        AlertTriangleIcon
    }
}
</script>
