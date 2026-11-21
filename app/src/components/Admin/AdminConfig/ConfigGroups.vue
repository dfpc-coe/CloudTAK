<template>
    <div>
        <Teleport
            defer
            to='#admin-config-actions'
        >
            <TablerIconButton
                v-if='!edit'
                title='Edit'
                @click.stop='edit = true'
            >
                <IconPencil
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <div
                v-else
                class='d-flex gap-1'
            >
                <TablerIconButton
                    color='rgba(var(--tblr-primary-rgb), 0.14)'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy
                        :size='32'
                        color='rgb(var(--tblr-primary-rgb))'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </Teleport>
        <div class='col-lg-12 py-2 px-2'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />
                <div class='row'>
                    <div
                        v-for='group in groups'
                        :key='group'
                        class='col-lg-12'
                    >
                        <TablerInput
                            v-model='config[`group::${group}`]'
                            :label='group'
                            :disabled='!edit'
                        />
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { server } from '../../../std.ts';
import {
    TablerLoading,
    TablerInput,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX,
} from '@tabler/icons-vue';

const groups = [
    'Yellow', 'Cyan', 'Green', 'Red', 'Purple', 'Orange', 'Blue',
    'Magenta', 'White', 'Maroon', 'Dark Blue', 'Teal', 'Dark Green', 'Brown'
] as const;

type GroupName = (typeof groups)[number];
type GroupConfigKey = `group::${GroupName}`;
type GroupConfig = Record<GroupConfigKey, string>;

function createGroupConfig(): GroupConfig {
    return {
        'group::Yellow': '',
        'group::Cyan': '',
        'group::Green': '',
        'group::Red': '',
        'group::Purple': '',
        'group::Orange': '',
        'group::Blue': '',
        'group::Magenta': '',
        'group::White': '',
        'group::Maroon': '',
        'group::Dark Blue': '',
        'group::Teal': '',
        'group::Dark Green': '',
        'group::Brown': '',
    };
}

const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<GroupConfig>(createGroupConfig());

onMounted(() => {
     void fetch();
});

async function fetch(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        const { data, error } = await server.GET('/api/config', {
            params: {
                query: {
                    keys: Object.keys(config.value).join(',')
                }
            }
        });
        if (error) throw new Error(error.message);
        config.value = {
            ...createGroupConfig(),
            ...data,
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}

async function save(): Promise<void> {
    loading.value = true;
    err.value = null;
    try {
        const { error } = await server.PUT('/api/config', {
            body: config.value
        });
        if (error) throw new Error(error.message);
        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Groups config:', error);
    }
    loading.value = false;
}
</script>
