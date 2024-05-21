<template>
    <div class='datagrid'>
        <div class='datagrid-item pb-2'>
            <div class='datagrid-title'>
                Created
            </div>
            <div
                class='datagrid-content'
                v-text='mission.createTime'
            />
        </div>
        <div class='datagrid-item pb-2'>
            <div class='datagrid-title'>
                Subscribers
            </div>
            <div
                class='datagrid-content'
                v-text='subscriptions.length'
            />
        </div>
        <div class='datagrid-item pb-2'>
            <div class='datagrid-title'>
                Groups (Channels)
            </div>
            <div
                class='datagrid-content'
                v-text='mission.groups.join(", ")'
            />
        </div>
    </div>
    <div class='datagrid'>
        <div class='datagrid-item pb-2'>
            <div class='datagrid-title'>
                Description
            </div>
            <div
                class='datagrid-content'
                v-text='mission.description || "No Feed Description"'
            />
        </div>
    </div>
    <div class='datagrid d-flex'>
        <div class='datagrid-item'>
            <div class='datagrid-title'>
                Created
            </div>
            <div
                class='datagrid-content'
                v-text='mission.createTime ? mission.createTime.replace(/T.*/, "") : "Unknown"'
            />
        </div>

        <div class='datagrid-item'>
            <div class='datagrid-title'>
                Contents
            </div>
            <div
                class='datagrid-content'
                v-text='Array.isArray(mission.content) ? mission.contents.length : 0 + " Items"'
            />
        </div>
    </div>
</template>

<script>
export default {
    name: 'MissionInfo',
    props: {
        mission: Object
    },
}
</script>
