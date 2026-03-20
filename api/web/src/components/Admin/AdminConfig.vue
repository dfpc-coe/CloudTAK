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
            <ConfigGeofence />
            <ConfigMedia />
            <ConfigProxy />
            <ConfigRetention />
            <ConfigDisplay />
            <ConfigGroups />
            <ConfigMap />
            <ConfigProvider />
        </div>
    </div>
</template>

<script setup lang="ts">
import ConfigLogin from './AdminConfig/ConfigLogin.vue';
import ConfigAgol from './AdminConfig/ConfigAgol.vue';
import ConfigGeofence from './AdminConfig/ConfigGeofence.vue';
import ConfigMedia from './AdminConfig/ConfigMedia.vue';
import ConfigProxy from './AdminConfig/ConfigProxy.vue';
import ConfigRetention from './AdminConfig/ConfigRetention.vue';
import ConfigDisplay from './AdminConfig/ConfigDisplay.vue';
import ConfigGroups from './AdminConfig/ConfigGroups.vue';
import ConfigMap from './AdminConfig/ConfigMap.vue';
import ConfigProvider from './AdminConfig/ConfigProvider.vue';
</script>
