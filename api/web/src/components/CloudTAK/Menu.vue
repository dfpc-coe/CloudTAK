<template>
<div class='position-absolute end-0 bottom-0 text-white py-2 bg-dark' style='z-index: 1; width: 400px; top: 50px;'>
    <div class='row'>
        <div class='cursor-pointer col-12 py-2 px-2 d-flex align-items-center'>
            <SettingsIcon size='40'/>
            <span class='mx-2' style='font-size: 18px;'>Settings</span>
        </div>
    </div>
</div>
</template>

<script>
import {
    SettingsIcon
} from 'vue-tabler-icons';

export default {
    name: 'CloudTAKMenu',
    components: {
        SettingsIcon
    }
}
</script>
