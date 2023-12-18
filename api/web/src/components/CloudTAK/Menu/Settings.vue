<template>
<div class='row'>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Settings</div>
            <div/>
        </div>
    </div>
    <div class='col-12 row'>
        <div @click='mode = "settings"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center'>
            <IconSettings size='32'/>
            <span class='mx-2' style='font-size: 18px;'>Settings</span>
        </div>
    </div>
</div>
</template>

<script>
import {
    IconCircleArrowLeft
} from '@tabler/icons-vue';

export default {
    name: 'Settings',
    data: function() {
        return {
        }
    },
    components: {
        IconCircleArrowLeft
    }
}
</script>
