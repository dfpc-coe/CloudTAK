<template>
    <div>
        <div class='card-header'>
            <TablerIconButton
                title='Back to Overview'
                class='me-2'
                data-config='back'
                @click='router.push("/admin")'
            >
                <IconCircleArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <h3
                class='card-title'
                v-text='active ? active.label : "Settings"'
            />
            <div
                id='admin-config-actions'
                class='ms-auto btn-list'
            />
        </div>

        <TablerNone
            v-if='!active'
            label='Unknown Setting'
            :create='false'
        />
        <component
            :is='components[active.slug]'
            v-else-if='active.slug === "plugins"'
        />
        <div
            v-else
            class='card-body'
        >
            <component
                :is='components[active.slug]'
                :key='active.slug'
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
    TablerNone,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconCircleArrowLeft,
} from '@tabler/icons-vue';
import { sections } from './AdminConfig/sections.ts';
import AdminPlugins from './AdminPlugins.vue';
import ConfigLogin from './AdminConfig/ConfigLogin.vue';
import ConfigSearch from './AdminConfig/ConfigSearch.vue';
import ConfigRouting from './AdminConfig/ConfigRouting.vue';
import ConfigMedia from './AdminConfig/ConfigMedia.vue';
import ConfigProxy from './AdminConfig/ConfigProxy.vue';
import ConfigRetention from './AdminConfig/ConfigRetention.vue';
import ConfigNotifications from './AdminConfig/ConfigNotifications.vue';
import ConfigDisplay from './AdminConfig/ConfigDisplay.vue';
import ConfigApplications from './AdminConfig/ConfigApplications.vue';
import ConfigCoreEntities from './AdminConfig/ConfigCoreEntities.vue';
import ConfigGroups from './AdminConfig/ConfigGroups.vue';
import ConfigMap from './AdminConfig/ConfigMap.vue';
import ConfigProvider from './AdminConfig/ConfigProvider.vue';
import ConfigScim from './AdminConfig/ConfigScim.vue';
import ConfigCoturn from './AdminConfig/ConfigCoturn.vue';

const route = useRoute();
const router = useRouter();

const components: Record<string, Component> = {
    login: ConfigLogin,
    search: ConfigSearch,
    routing: ConfigRouting,
    media: ConfigMedia,
    plugins: AdminPlugins,
    proxy: ConfigProxy,
    retention: ConfigRetention,
    notifications: ConfigNotifications,
    display: ConfigDisplay,
    applications: ConfigApplications,
    events: ConfigCoreEntities,
    groups: ConfigGroups,
    map: ConfigMap,
    provider: ConfigProvider,
    scim: ConfigScim,
    coturn: ConfigCoturn,
};

const active = computed(() => sections.find(section => section.slug === route.params.section));
</script>
