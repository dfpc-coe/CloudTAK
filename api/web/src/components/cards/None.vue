<template>
<div :class='{
    "card": !compact
}'>
    <div class='card-body'>
        <div class='d-flex justify-content-center mt-4 mb-2'>
            <NotesOffIcon
                width='48'
                height='48'
            />
        </div>

        <div class='d-flex justify-content-center mb-4 mt-2'>
            <div>No <span v-text='label'/> Found</div>
        </div>

        <div v-if='create' @click='$emit("create")' class='d-flex justify-content-center my-4'>
            <div class='btn btn-primary'><span>Create <span v-text='label'/></span></div>
        </div>
    </div>
</div>
</template>

<script>
import {
    NotesOffIcon
} from 'vue-tabler-icons'

export default {
    name: 'None',
    props: {
        create: {
            type: Boolean,
            default: true
        },
        compact: {
            type: Boolean,
            default: false
        },
        label: {
            type: String,
            default: 'Items'
        }
    },
    components: {
        NotesOffIcon
    }
}
</script>
