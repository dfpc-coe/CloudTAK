<template>
<div class='row'>
    <div class='col-12 border-light border-bottom'>
        <div class='card-header my-2'>
            <div class='card-title mx-2'>Settings</div>
        </div>
    </div>
    <div @click='mode = "settings"' class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center'>
        <SettingsIcon size='32'/>
        <span class='mx-2' style='font-size: 18px;'>Settings</span>
    </div>
</div>
</template>

<script>
import {
} from 'vue-tabler-icons';

export default {
    name: 'Settings',
    props: {
        map: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
        }
    },
    components: {
    }
}
</script>
