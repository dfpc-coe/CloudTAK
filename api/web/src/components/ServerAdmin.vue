<template>
    <div
        class='h-full w-full cloudtak-page'
        style='overflow: auto;'
    >
        <NavHeader title='Admin' />

        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <TablerLoading
                                v-if='isAdmin === undefined'
                                desc='Loading Profile'
                            />
                            <TablerAlert
                                v-else-if='!isAdmin'
                                :err='new Error("Insufficient Access")'
                            />
                            <div
                                v-else
                                style='height: 100%;'
                                class='row g-0 admin-layout'
                            >
                                <div
                                    class='border-end admin-sidebar'
                                    :class='{
                                        "col-12 col-md-3": !nest,
                                        "admin-sidebar--nest": nest,
                                        "admin-sidebar--hover": nest && hovered
                                    }'
                                    @mouseenter='hovered = true'
                                    @mouseleave='hovered = false'
                                >
                                    <div class='card-body admin-sidebar-panel'>
                                        <template
                                            v-for='section in sections'
                                            :key='section.title'
                                        >
                                            <h4
                                                :class='{
                                                    "text-center": collapsed,
                                                    "py-2 my-0": section !== sections[0]
                                                }'
                                                class='subheader user-select-none'
                                            >
                                                {{ collapsed ? section.short : section.title }}
                                            </h4>
                                            <div
                                                role='menu'
                                                class='list-group list-group-transparent'
                                            >
                                                <span
                                                    v-for='item in section.items'
                                                    :key='item.to'
                                                    tabindex='0'
                                                    role='menuitem'
                                                    class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                                                    :class='{
                                                        "active": isActive(item),
                                                        "cursor-pointer": !isActive(item)
                                                    }'
                                                    :title='collapsed ? item.label : undefined'
                                                    @keyup.enter='router.push(item.to)'
                                                    @click='router.push(item.to)'
                                                >
                                                    <component
                                                        :is='item.icon'
                                                        :size='32'
                                                        stroke='1'
                                                    />
                                                    <span class='mx-3 admin-sidebar-label'>{{ item.label }}</span>
                                                </span>
                                            </div>
                                        </template>
                                    </div>
                                </div>
                                <div
                                    class='col-12 position-relative'
                                    style='height: 100%;'
                                    :style='nest ? "width: calc(100% - 64px);" : ""'
                                    :class='{
                                        "col-md-9": !nest,
                                    }'
                                >
                                    <Suspense>
                                        <router-view />

                                        <template #fallback>
                                            <TablerLoading />
                                        </template>
                                    </Suspense>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <PageFooter />
    </div>
</template>

<script setup lang='ts'>
import { onMounted, ref, computed } from 'vue';
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { Profile } from '../types.ts';
import { server } from '../std.ts';
import PageFooter from './PageFooter.vue';
import NavHeader from './util/NavHeader.vue';
import {
    TablerAlert,
    TablerLoading,
} from '@tak-ps/vue-tabler'
import {
    IconCloud,
    IconNetwork,
    IconVideo,
    IconUsers,
    IconFileImport,
    IconMapPin,
    IconSettings,
    IconServer,
    IconHeartbeat,
    IconDatabase,
    IconDatabaseCog,
    IconDatabaseExport,
    IconBrandDocker,
    IconBuildingBroadcastTower,
    IconMap,
    IconClipboardList,
} from '@tabler/icons-vue'

const route = useRoute();
const router = useRouter();
const isAdmin = ref<boolean | undefined>(undefined)
const hovered = ref(false);

type MenuItem = { label: string; to: string; match: string; icon: Component };
type MenuSection = { title: string; short: string; items: MenuItem[] };

const sections: MenuSection[] = [{
    title: 'CloudTAK Admin',
    short: 'Admin',
    items: [
        { label: 'TAK Server Connection', to: '/admin/server', match: 'admin-server', icon: IconServer },
        { label: 'CloudTAK Settings', to: '/admin/config', match: 'admin-config', icon: IconSettings },
        { label: 'Health', to: '/admin/health', match: 'admin-health', icon: IconHeartbeat },
    ]
}, {
    title: 'Map Settings',
    short: 'Map',
    items: [
        { label: 'Users', to: '/admin/user', match: 'admin-user', icon: IconUsers },
        { label: 'User Imports', to: '/admin/import', match: 'admin-import', icon: IconFileImport },
        { label: 'Hosted Tilesets', to: '/admin/public', match: 'admin-public', icon: IconCloud },
        { label: 'Basemaps & Overlays', to: '/admin/overlay', match: 'admin-overlays', icon: IconMap },
        { label: 'Mission Templates', to: '/admin/templates', match: 'admin-mission-template', icon: IconClipboardList },
    ]
}, {
    title: 'ETL Settings',
    short: 'ETL',
    items: [
        { label: 'Connections', to: '/admin/connection', match: 'admin-connection', icon: IconNetwork },
        { label: 'Core Data', to: '/admin/coredata', match: 'admin-coredata', icon: IconDatabaseCog },
        { label: 'Layers', to: '/admin/layer', match: 'admin-layer', icon: IconBuildingBroadcastTower },
        { label: 'Integrations', to: '/admin/tasks', match: 'admin-task', icon: IconBrandDocker },
        { label: 'Data Syncs', to: '/admin/data', match: 'admin-data', icon: IconDatabase },
    ]
}, {
    title: 'External Services',
    short: 'EXT',
    items: [
        { label: 'Video Services', to: '/admin/video', match: 'admin-video', icon: IconVideo },
        { label: 'Geofence Server', to: '/admin/geofence', match: 'admin-geofence', icon: IconMapPin },
        { label: 'Export', to: '/admin/export', match: 'admin-export', icon: IconDatabaseExport },
    ]
}];

const isActive = (item: MenuItem) => String(route.name).startsWith(item.match);

const nest = computed(() => {
    if (String(route.name).startsWith('admin-server') || String(route.name).startsWith('admin-coredata')) {
        return true;
    } else {
        return false;
    }
});

const collapsed = computed(() => nest.value && !hovered.value);

onMounted(async () => {
    const res = await server.GET('/api/profile');
    if (res.error) throw new Error(res.error.message);
    isAdmin.value = (res.data as Profile).system_admin;
});
</script>

<style scoped>
.admin-layout {
    container-type: inline-size;
}

.admin-sidebar--nest {
    width: 64px;
    position: relative;
}

.admin-sidebar--nest .admin-sidebar-panel {
    position: relative;
    width: 64px;
    min-height: 100%;
    overflow: hidden;
    white-space: nowrap;
    background-color: var(--cloudtak-panel-bg);
    color: var(--cloudtak-surface-color);
    transition: width 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    z-index: 1020;
}

.admin-sidebar--nest .list-group-item > svg {
    flex-shrink: 0;
}

.admin-sidebar--nest .admin-sidebar-label {
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
}

.admin-sidebar--hover .admin-sidebar-label {
    opacity: 1;
}

.admin-sidebar--hover .admin-sidebar-panel {
    width: calc(64px + (100cqw - 64px) * 0.25);
    border-right: 1px solid var(--cloudtak-surface-border);
    box-shadow: var(--tblr-card-box-shadow);
}
</style>
