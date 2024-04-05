<template>
<div class='container px-0'>
    <div class='sticky-top col-12 border-bottom border-light bg-dark'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title' v-text='name'></div>
            <div class='btn-list'>
                <slot name="buttons"/>
            </div>
        </div>
    </div>

    <div class='col-12 overflow-auto' style='height: calc(100vh - 114px)'>
        <slot/>
    </div>
</div>
</template>

<script>
import {
    IconCircleArrowLeft,
} from '@tabler/icons-vue'

export default {
    name: 'MenuTemplate',
    props: {
        name: {
            type: String,
            required: true
        }
    },
    components: {
        IconCircleArrowLeft,
    }
}
</script>
