<template>
    <MenuTemplate name='Package'>
        <template #buttons>
            <TablerDelete
                v-if='pkg && (profile && profile.username === pkg.SubmissionUser)'
                displaytype='icon'
                @delete='deleteFile(pkg.Hash)'
            />
            <a
                v-if='!loading && !error'
                v-tooltip='"Download Asset"'
                :href='downloadFile()'
            ><IconDownload
                :size='32'
                stroke='1'
                class='cursor-pointer'
            /></a>
        </template>
        <template #default>
            <TablerLoading v-if='loading || !pkg || !profile' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else-if='mode === "share" && shareFeat'>
                <div class='overflow-auto'>
                    <Share
                        :feats='[shareFeat]'
                        @done='mode = "default"'
                        @cancel='mode = "default"'
                    />
                </div>
            </template>
            <template v-else>
                <div
                    class='row g-2 mx-4 my-4'
                >
                    <div class='datagrid'>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Name
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='pkg.Name'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Created By
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='pkg.SubmissionUser'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Created
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='timeDiff(pkg.SubmissionDateTime)'
                            />
                        </div>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Hashtags`
                            </div>
                            <div class='datagrid-content'>
                                <div                                   
                                    v-if='pkg.Keywords.length'    
                                    class='col-12 pt-1'    
                                >                               
                                    <span                                 
                                        v-for='keyword in pkg.Keywords'                        
                                        :key='keyword'    
                                        class='me-1 badge badge-outline bg-blue-lt'    
                                        v-text='keyword'    
                                    />                            
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class='col-md-6 py-3'>
                        <button
                            class='btn btn-primary w-100'
                            @click='createImport'
                        >
                            <IconFileImport
                                :size='20'
                                stroke='1'
                                class='me-2'
                            />Import
                        </button>
                    </div>
                    <div class='col-md-6 py-3'>
                        <button
                            class='btn btn-secondary w-100'
                            @click='mode === "share" ? mode = "default" : mode = "share"'
                        >
                            <IconShare2
                                v-tooltip='"Share"'
                                :size='20'
                                stroke='1'
                                class='me-2'
                            /> Share
                        </button>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import type { Profile, Server, Package, Import, Feature } from '../../../../src/types.ts';
import { std, stdurl } from '../../../../src/std.ts';
import Share from '../util/Share.vue';
import timeDiff from '../../../timediff.ts';
import {
    TablerAlert,
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    IconShare2,
    IconDownload,
    IconFileImport
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';

const route = useRoute();
const router = useRouter();
const mapStore = useMapStore();

const loading = ref(true);
const error = ref<Error | undefined>()
const mode = ref('default');
const server = ref<Server | undefined>();
const pkg = ref<Package | undefined>();

watch(route, async () => {
    await fetch();
});

const profile = ref<Profile | undefined>(undefined);

const shareFeat = computed<Feature | undefined>(() => {
    if (!profile.value || !pkg.value || !server.value) return;

    return {
        type: 'Feature',
        properties: {
            type: 'b-f-t-r',
            how: 'h-e',
            fileshare: {
                filename: pkg.value.Name + '.zip',
                senderUrl: `${server.value.api}/Marti/sync/content?hash=${pkg.value.Hash}`,
                sizeInBytes: parseInt(pkg.value.Size),
                sha256: pkg.value.Hash,
                senderUid: `ANDROID-CloudTAK-${profile.value.username}`,
                senderCallsign: profile.value.tak_callsign,
                name: pkg.value.Name
            },
            metadata: {},
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0, 0]
        }
    } as Feature;
});


onMounted(async () => {
    profile.value = await mapStore.worker.profile.load();
    server.value = await mapStore.worker.profile.loadServer();
    await fetch();
});

function downloadFile(): string {
    if (!pkg.value) return '';

    const url = stdurl(`/api/marti/api/files/${pkg.value.Hash}`)
    url.searchParams.append('token', localStorage.token);
    url.searchParams.append('name', pkg.value.Name + '.zip');
    return String(url);
}

async function fetch() {
    try {
        loading.value = true;
        const url = stdurl(`/api/marti/package/${route.params.package}`);
        pkg.value = await std(url) as Package;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }

    loading.value = false;
}

async function deleteFile(uid: string) {
    loading.value = true;

    try {
        await std(`/api/marti/package/${uid}`, {
            method: 'DELETE',
        });

        router.push(`/menu/packages`)
    } catch (err) {
        loading.value = false;
        throw err;
    }

}

async function createImport() {
    if (!pkg.value) return;

    loading.value = true;
    const imp = await std('/api/import', {
        method: 'POST',
        body: {
            name: pkg.value.Name,
            source: 'Package',
            source_id: pkg.value.UID
        }
    }) as Import;

    router.push(`/menu/imports/${imp.id}`)
}
</script>
