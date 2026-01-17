<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                CloudTAK Settings
            </h3>
        </div>
        <div class='card-body row'>
            <ConfigLogin />
            <ConfigAgol />
            <ConfigMedia />
            <ConfigDisplay />
            <ConfigGroups />
            <ConfigMap />
            <ConfigProvider />
        </div>
    </div>
</template>

<script setup>
import ConfigLogin from './AdminConfig/ConfigLogin.vue';
import ConfigAgol from './AdminConfig/ConfigAgol.vue';
import ConfigMedia from './AdminConfig/ConfigMedia.vue';
import ConfigDisplay from './AdminConfig/ConfigDisplay.vue';
import ConfigGroups from './AdminConfig/ConfigGroups.vue';
import ConfigMap from './AdminConfig/ConfigMap.vue';
import ConfigProvider from './AdminConfig/ConfigProvider.vue';
</script>
