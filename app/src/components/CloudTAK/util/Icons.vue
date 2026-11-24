<template>
    <div class='d-flex flex-column gap-3 py-3 px-1'>
        <TablerInput
            v-model='filter'
            icon='search'
            placeholder='Filter iconsets and icons'
        />

        <TablerLoading
            v-if='loading'
            desc='Loading Iconsets'
        />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <TablerNone
            v-else-if='!groups.length'
            :label='filter ? "No matches" : "No Iconsets"'
            :create='false'
        />
        <div
            v-else
            class='d-flex flex-column gap-1'
        >
            <section
                v-for='group in groups'
                :key='group.uid'
                class='d-flex flex-column gap-2'
            >
                <div class='d-flex align-items-center'>
                    <button
                        type='button'
                        class='icons-group-toggle flex-grow-1 d-flex align-items-center gap-2'
                        :aria-expanded='isOpen(group)'
                        @click='toggle(group)'
                    >
                        <component
                            :is='isOpen(group) ? IconChevronDown : IconChevronRight'
                            :size='14'
                            stroke='2.5'
                            class='icons-muted flex-shrink-0'
                        />
                        <IconAlbum
                            :size='18'
                            stroke='1.5'
                            class='icons-muted flex-shrink-0'
                        />
                        <span
                            class='fw-semibold text-truncate'
                            v-text='group.name'
                        />
                        <span
                            class='icons-muted'
                            v-text='group.icons.length'
                        />
                    </button>
                    <TablerIconButton
                        title='Open Iconset'
                        @click='router.push(`/menu/iconset/${group.uid}`)'
                    >
                        <IconArrowRight
                            :size='20'
                            stroke='1.5'
                        />
                    </TablerIconButton>
                </div>

                <div
                    v-if='isOpen(group) && !group.icons.length'
                    class='icons-muted small pb-2'
                >
                    No icons yet.
                </div>
                <template v-else-if='isOpen(group)'>
                    <div class='icons-grid pb-2'>
                        <IconTile
                            v-for='icon in visible(group)'
                            :key='icon.name'
                            :icon='icon'
                            :src='iconUrl(icon)'
                            @click='openIcon(icon)'
                        />
                    </div>
                    <button
                        v-if='group.icons.length > visible(group).length'
                        type='button'
                        class='btn mb-2'
                        @click='expanded = new Set(expanded).add(group.uid)'
                    >
                        Show all {{ group.icons.length }} icons
                    </button>
                </template>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { Subscription } from 'dexie';
import { useRouter } from 'vue-router';
import IconCache from '../../../base/icon.ts';
import IconsetCache from '../../../base/iconset.ts';
import IconTile from './IconTile.vue';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconAlbum,
    IconArrowRight,
    IconChevronDown,
    IconChevronRight,
} from '@tabler/icons-vue';
import type { DBIcon, DBIconset } from '../../../database.ts';

interface Group {
    uid: string;
    name: string;
    icons: DBIcon[];
}

const PAGE = 96;

const router = useRouter();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);

const filter = ref('');
const icons = ref<DBIcon[]>([]);
const iconsets = ref<DBIconset[]>([]);
const open = ref<Set<string> | null>(null);
const expanded = ref(new Set<string>());

const urls = new Map<string, string>();
let subscription: Subscription | undefined;

const groups = computed<Group[]>(() => {
    const needle = filter.value.trim().toLowerCase();
    const grouped = new Map<string, DBIcon[]>();

    for (const icon of icons.value) {
        const list = grouped.get(icon.iconset);
        if (list) list.push(icon);
        else grouped.set(icon.iconset, [icon]);
    }

    const res: Group[] = [];
    for (const iconset of iconsets.value) {
        const all = grouped.get(iconset.uid) ?? [];

        if (!needle || iconset.name.toLowerCase().includes(needle)) {
            res.push({ uid: iconset.uid, name: iconset.name, icons: all });
            continue;
        }

        const matched = all.filter((icon) => {
            return icon.path.toLowerCase().includes(needle)
                || (icon.type2525b || '').toLowerCase().includes(needle);
        });

        if (matched.length) res.push({ uid: iconset.uid, name: iconset.name, icons: matched });
    }

    return res;
});

onMounted(() => {
    subscription = IconsetCache.liveList().subscribe({
        next: (list) => {
            void load(list);
        },
        error: (err: unknown) => {
            error.value = err instanceof Error ? err : new Error(String(err));
            loading.value = false;
        }
    });
});

onUnmounted(() => {
    subscription?.unsubscribe();
    revokeUrls();
});

async function load(list: DBIconset[]): Promise<void> {
    try {
        const all = await IconCache.all();

        revokeUrls();
        error.value = undefined;
        iconsets.value = list;
        icons.value = all.sort((a, b) => a.path.localeCompare(b.path));

        open.value ??= new Set(all.length <= PAGE ? list.map((iconset) => iconset.uid) : []);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

function revokeUrls(): void {
    for (const url of urls.values()) URL.revokeObjectURL(url);
    urls.clear();
}

function iconUrl(icon: DBIcon): string {
    let url = urls.get(icon.name);
    if (!url) {
        url = URL.createObjectURL(icon.data);
        urls.set(icon.name, url);
    }
    return url;
}

function isOpen(group: Group): boolean {
    return !!filter.value.trim() || !!open.value?.has(group.uid);
}

function toggle(group: Group): void {
    const next = new Set(open.value);
    if (!next.delete(group.uid)) next.add(group.uid);
    open.value = next;
}

function visible(group: Group): DBIcon[] {
    return expanded.value.has(group.uid) ? group.icons : group.icons.slice(0, PAGE);
}

function openIcon(icon: DBIcon): void {
    router.push(`/menu/iconset/${icon.iconset}/${encodeURIComponent(icon.path)}`);
}
</script>

<style scoped>
.icons-muted {
    color: var(--tblr-secondary-color);
}

.icons-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 0.5rem;
}

.icons-group-toggle {
    min-width: 0;
    min-height: 44px;
    padding: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    background: none;
    border: 0;
    border-radius: 6px;
}

.icons-group-toggle:focus-visible {
    outline: 2px solid var(--tblr-primary);
}
</style>
