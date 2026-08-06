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
                        Core Data
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
                                "active": String(route.name) === "admin-coredata-devices",
                                "cursor-pointer": String(route.name) !== "admin-coredata-devices"
                            }'
                            @click='router.push(`/admin/coredata/devices`)'
                        >
                            <IconDevices
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-3'
                            >Core Devices</span>
                        </span>
                        <span
                            tabindex='0'
                            role='menuitem'
                            class='list-group-item list-group-item-action d-flex align-items-center user-select-none'
                            :class='{
                                "active": String(route.name) === "admin-coredata-events",
                                "cursor-pointer": String(route.name) !== "admin-coredata-events"
                            }'
                            @click='router.push(`/admin/coredata/events`)'
                        >
                            <IconCalendarEvent
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-3'
                            >Core Events</span>
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
    IconDevices,
    IconCalendarEvent,
} from '@tabler/icons-vue'

const route = useRoute()
const router = useRouter()
</script>
