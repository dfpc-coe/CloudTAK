<template>
    <div
        style='height: 100%;'
        class='col-lg-12'
    >
        <div
            style='height: 100%;'
            class='row g-0'
        >
            <div
                style='height: 100%;'
                class='border-end col-12 col-md-3'
            >
                <div class='card-body'>
                    <h4 class='subheader user-select-none'>
                        TAK Server
                    </h4>
                    <div
                        role='menu'
                        class='list-group list-group-transparent'
                    >
                        <span
                            tabindex='0'
                            role='menuitem'
                            class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                            :class='{
                                "active": String(route.name) === "admin-server-connection",
                                "cursor-pointer": String(route.name) !== "admin-server-connection"
                            }'
                            @click='router.push(`/admin/server/connection`)'
                        >
                            <IconServer
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-3'
                            >Connection</span>
                        </span>
                        <span
                            tabindex='0'
                            role='menuitem'
                            class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                            :class='{
                                "active": String(route.name) === "admin-server-injector",
                                "cursor-pointer": String(route.name) !== "admin-server-injector"
                            }'
                            @click='router.push(`/admin/server/injector`)'
                        >
                            <IconVaccine
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-3'
                            >Injectors</span>
                        </span>
                        <span
                            tabindex='0'
                            role='menuitem'
                            class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                            :class='{
                                "active": String(route.name) === "admin-server-repeater",
                                "cursor-pointer": String(route.name) !== "admin-server-repeater"
                            }'
                            @click='router.push(`/admin/server/repeater`)'
                        >
                            <IconBuildingLighthouse
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-3'
                            >Repeaters</span>
                        </span>
                        <span
                            tabindex='0'
                            role='menuitem'
                            class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                            :class='{
                                "active": String(route.name) === "admin-server-packages",
                                "cursor-pointer": String(route.name) !== "admin-server-packages"
                            }'
                            @click='router.push(`/admin/server/packages`)'
                        >
                            <IconPackages
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-3'
                            >Packages</span>
                        </span>
                        <span
                            tabindex='0'
                            role='menuitem'
                            class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                            :class='{
                                "active": String(route.name) === "admin-server-videos",
                                "cursor-pointer": String(route.name) !== "admin-server-videos"
                            }'
                            @click='router.push(`/admin/server/videos`)'
                        >
                            <IconVideo
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-3'
                            >Videos</span>
                        </span>
                    </div>
                </div>
            </div>
            <div class='col-12 col-md-9 position-relative'>
                <Suspense>
                    <router-view />

                    <template #fallback>
                        <TablerLoading />
                    </template>
                </Suspense>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { useRoute, useRouter } from 'vue-router'
import {
    TablerLoading,
} from '@tak-ps/vue-tabler'
import {
    IconBuildingLighthouse,
    IconPackages,
    IconVaccine,
    IconServer,
    IconVideo,
} from '@tabler/icons-vue'

const route = useRoute()
const router = useRouter()
</script>
