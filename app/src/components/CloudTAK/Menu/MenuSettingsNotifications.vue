<template>
    <MenuTemplate
        name='Notifications'
        :loading='loading'
    >
        <div class='col-12 d-flex flex-column gap-2 py-2'>
            <StandardItem
                v-for='item of settings'
                :key='item.type'
                @click='toggle(item.type)'
            >
                <div class='d-flex align-items-center gap-3 px-3 py-3'>
                    <div
                        class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 flex-shrink-0'
                        style='width: 40px; height: 40px;'
                    >
                        <NotificationIcon
                            :type='item.type'
                            :size='24'
                        />
                    </div>
                    <div
                        class='flex-grow-1'
                        style='min-width: 0'
                    >
                        <div
                            class='fw-bold'
                            v-text='item.label'
                        />
                        <div
                            class='text-secondary small'
                            v-text='item.description'
                        />
                    </div>
                    <label
                        class='form-switch m-0'
                        @click.stop
                    >
                        <input
                            class='form-check-input cursor-pointer'
                            type='checkbox'
                            :aria-label='item.label'
                            :checked='enabled[item.type]'
                            @change='toggle(item.type)'
                        >
                    </label>
                </div>
            </StandardItem>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import NotificationIcon from '../util/NotificationIcon.vue';
import ProfileConfig from '../../../base/profile.ts';
import { NotificationType, NotificationProfileKeys } from '../../../base/notification.ts';

const settings: Array<{
    type: NotificationType;
    label: string;
    description: string;
}> = [{
    type: NotificationType.Alert,
    label: 'Alerts',
    description: 'Emergency alerts such as 911, Ring the Bell, and Troops in Contact'
}, {
    type: NotificationType.Medical,
    label: 'Medical',
    description: 'New CASEVAC requests'
}, {
    type: NotificationType.Chat,
    label: 'Chats',
    description: 'Incoming chat messages'
}, {
    type: NotificationType.Mission,
    label: 'Data Syncs',
    description: 'New Data Syncs, log entries, and file changes'
}, {
    type: NotificationType.Import,
    label: 'Imports',
    description: 'Status changes on your file imports'
}, {
    type: NotificationType.Contact,
    label: 'Contacts',
    description: 'Contacts coming online'
}];

const loading = ref(true);
const enabled = ref<Record<NotificationType, boolean>>(
    Object.fromEntries(
        Object.values(NotificationType).map((type) => [type, true])
    ) as Record<NotificationType, boolean>
);

onMounted(async () => {
    for (const type of Object.values(NotificationType)) {
        const config = await ProfileConfig.get(NotificationProfileKeys[type]);
        enabled.value[type] = config?.value !== false;
    }

    loading.value = false;
});

async function toggle(type: NotificationType): Promise<void> {
    const value = !enabled.value[type];
    enabled.value[type] = value;

    try {
        const key = NotificationProfileKeys[type];
        await new ProfileConfig(key, value).commit(value);
    } catch (err) {
        enabled.value[type] = !value;
        throw err;
    }
}
</script>
