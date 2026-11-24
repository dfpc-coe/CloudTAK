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
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config["coturn::url"]'
                            :disabled='!edit'
                            label='CoTURN Server URL'
                        />
                    </div>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config["coturn::secret"]'
                            type='password'
                            autocomplete='new-password'
                            :disabled='!edit'
                            label='CoTURN Shared Secret'
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

interface CoturnConfig {
    'coturn::url': string;
    'coturn::secret': string;
}

const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<CoturnConfig>({
    'coturn::url': '',
    'coturn::secret': '',
});

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
            'coturn::url': data['coturn::url'] ?? '',
            'coturn::secret': data['coturn::secret'] ?? '',
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
        console.error('Failed to save CoTURN config:', error);
    }
    loading.value = false;
}
</script>
