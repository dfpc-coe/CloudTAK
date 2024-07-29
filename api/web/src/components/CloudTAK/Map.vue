<template>
    <div
        data-bs-theme='dark'
        class='d-flex position-relative'
        style='height: calc(100vh) !important;'
    >
        <div
            ref='map'
            style='width: 100%;'
        />

        <Loading v-if='loading.main || !isLoaded' />

        <template v-if='isLoaded && !loading.main'>
            <div
                v-if='mode === "Default"'
                class='position-absolute top-0 end-0 text-white py-2'
                style='z-index: 1; width: 60px; background-color: rgba(0, 0, 0, 0.5);'
            >
                <IconMenu2
                    v-if='noMenuShown'
                    :size='40'
                    :stroke='1'
                    class='mx-2 cursor-pointer hover-button'
                    @click='$router.push("/menu")'
                />
                <IconX
                    v-else
                    :size='40'
                    :stroke='1'
                    class='mx-2 cursor-pointer bg-dark'
                    @click='closeAllMenu'
                />
            </div>

            <WarnChannels
                v-if='warnChannels'
                @close='warnChannels = false'
            />

            <div
                v-if='profile'
                class='position-absolute bottom-0 begin-0 text-white'
                style='
                    z-index: 1;
                    width: 200px;
                    height: 40px;
                    border-radius: 0px 6px 0px 0px;
                    background-color: rgba(0, 0, 0, 0.5);
                '
            >
                <div class='d-flex align-items-center h-100'>
                    <div
                        v-tooltip='"Set Location"'
                        class='hover-button h-100 px-2 d-flex align-items-center cursor-pointer'
                        style='width: 40px;'
                    >
                        <IconLocationOff
                            v-if='!profile.tak_loc'
                            :size='20'
                            :stroke='1'
                            @click='setLocation'
                        />
                        <IconLocation
                            v-else
                            :size='20'
                            :stroke='1'
                            @click='setLocation'
                        />
                    </div>
                    <div
                        v-tooltip='"Zoom To Location"'
                        style='line-height: 40px; width: calc(100% - 40px);'
                        class='h-100 cursor-pointer text-center px-2 text-truncate subheader text-white hover-button'
                        @click='toLocation'
                        v-text='profile.tak_callsign'
                    />
                </div>
            </div>
            <div
                v-if='selected.size'
                class='position-absolute begin-0 text-white bg-dark'
                style='
                    z-index: 1;
                    bottom: 40px;
                    width: 200px;
                '
            >
                <SelectFeats :selected='selected' />
            </div>

            <div
                v-if='mode === "Default"'
                class='position-absolute top-0 beginning-0 text-white py-2 px-2'
                style='
                    z-index: 1;
                    width: 60px;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 0px 0px 6px 0px;
                '
            >
                <IconSearch
                    v-tooltip='"Search"'
                    :size='40'
                    :stroke='1'
                    class='cursor-pointer hover-button mb-3'
                    @click='search.shown = !search.shown'
                />

                <div
                    style='margin-bottom: 10px;'
                    class='cursor-pointer hover-button'
                    @click='setBearing(0)'
                >
                    <IconCircleArrowUp
                        v-tooltip='"Snap to North"'
                        :transform='`rotate(${360 - bearing})`'
                        :size='40'
                        :stroke='1'
                    />
                    <div
                        v-if='bearing !== 0'
                        class='text-center'
                        v-text='humanBearing'
                    />
                </div>
                <IconFocus2
                    v-if='!radial.cot && !locked.length'
                    v-tooltip='"Get Location"'
                    :size='40'
                    :stroke='1'
                    class='cursor-pointer hover-button'
                    @click='getLocation'
                />
                <IconLockAccess
                    v-else-if='!radial.cot'
                    :size='40'
                    :stroke='1'
                    class='cursor-pointer hover-button'
                    @click='locked.splice(0, locked.length)'
                />

                <div class='mt-3'>
                    <IconPlus
                        v-tooltip='"Zoom In"'
                        :size='40'
                        :stroke='1'
                        class='cursor-pointer hover-button'
                        @click='setZoom(getZoom() + 1);'
                    />
                    <IconMinus
                        v-tooltip='"Zoom Out"'
                        :size='40'
                        :stroke='1'
                        class='cursor-pointer hover-button'
                        @click='setZoom(getZoom() - 1);'
                    />
                </div>
            </div>

            <CoordInput
                v-if='pointInput'
                @close='pointInput = false'
            />

            <div
                v-if='search.shown'
                class='position-absolute top-0 text-white bg-dark'
                style='
                    z-index: 1;
                    left: 60px;
                    width: 200px;
                '
            >
                <TablerInput
                    v-model='search.filter'
                    class='mt-0'
                    placeholder='Place Search'
                    icon='search'
                />

                <div
                    v-for='item of search.results'
                    :key='item.magicKey'
                    class='col-12 px-2 py-2 hover-button cursor-pointer'
                    @click='fetchSearch(item.text, item.magicKey)'
                    v-text='item.text'
                />
            </div>

            <div
                v-if='false'
                class='position-absolute top-0 text-white bg-dark'
                style='
                    z-index: 1;
                    left: calc(50% - 100px);
                    width: 200px;
                '
            >
                <IconPoint
                    :size='40'
                    :stroke='1'
                />

                <img :url='`/api/iconset/default/icon/a-f-g/raw`'/>
            </div>

            <div
                v-if='isLoaded && mode === "Default"'
                class='d-flex position-absolute top-0 text-white py-2'
                style='
                    z-index: 2;
                    width: 120px;
                    right: 60px;
                    background-color: rgba(0, 0, 0, 0.5);
                    border-radius: 0px 0px 0px 6px;
                '
            >
                <TablerDropdown>
                    <template #default>
                        <div class='mx-2 cursor-pointer'>
                            <IconBell
                                :size='40'
                                :stroke='1'
                                class='hover-button'
                            />
                            <span
                                v-if='notifications.length'
                                class='badge bg-red mb-2'
                            />
                            <span
                                v-else
                                style='width: 10px;'
                            />
                        </div>
                    </template>
                    <template #dropdown>
                        <TablerNone
                            v-if='!notifications.length'
                            label='New Notifications'
                            :create='false'
                        />
                        <template v-else>
                            <div class='col-12 d-flex py-2 px-2'>
                                <div
                                    class='ms-auto cursor-pointer'
                                    @click='clearNotifications'
                                >
                                    Clear All
                                </div>
                            </div>
                            <div
                                v-for='n of notifications'
                                class='col-12 px-2 py-2'
                            >
                                <div
                                    v-if='n.type === "Chat"'
                                    class='col-12 cursor-pointer hover-dark'
                                    @click='$router.push(n.url)'
                                >
                                    <IconMessage
                                        :size='32'
                                        :stroke='1'
                                    />
                                    <span v-text='n.name' />
                                </div>
                            </div>
                        </template>
                    </template>
                </TablerDropdown>
                <TablerDropdown>
                    <template #default>
                        <IconPencil
                            :size='40'
                            :stroke='1'
                            class='mx-2 cursor-pointer hover-button'
                            @click='closeAllMenu'
                        />
                    </template>
                    <template #dropdown>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='pointInput = true'
                        >
                            <IconCursorText
                                :size='25'
                                :stroke='1'
                            /> Coordinate Input
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("point")'
                        >
                            <IconPoint
                                :size='25'
                                :stroke='1'
                            /> Draw Point
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("linestring")'
                        >
                            <IconLine
                                :size='25'
                                :stroke='1'
                            /> Draw Line
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("polygon")'
                        >
                            <IconPolygon
                                :size='25'
                                :stroke='1'
                            /> Draw Polygon
                        </div>
                        <div
                            class='col-12 py-1 px-2 hover-button cursor-pointer'
                            @click='startDraw("rectangle")'
                        >
                            <IconVector
                                :size='25'
                                :stroke='1'
                            /> Draw Rectangle
                        </div>
                    </template>
                </TablerDropdown>
            </div>

            <SideMenu
                v-if='isLoaded && !pointInput'
                :compact='noMenuShown'
                @reset='deleteCOT()'
            />

            <MultipleSelect
                v-if='select.feats.length'
            />

            <RadialMenu
                v-else-if='radial.mode'
                ref='radial'
                @close='closeRadial'
                @click='handleRadial($event)'
            />

            <CloudTAKFeatView
                v-if='feat && mode === "Default"'
                :key='feat.id'
                :feat='feat'
            />

            <template v-if='upload.shown'>
                <TablerModal>
                    <div class='modal-status bg-red' />
                    <button
                        type='button'
                        class='btn-close'
                        aria-label='Close'
                        @click='upload.shown = false'
                    />
                    <div class='modal-body text-white'>
                        <UploadImport
                            :dragging='upload.dragging'
                            :cancel-button='false'
                            @close='upload.shown = false'
                            @done='fileUpload($event)'
                        />
                    </div>
                </TablerModal>
            </template>
        </template>
    </div>
</template>

<script>
import WarnChannels from './util/WarnChannels.vue';
import CoordInput from './CoordInput.vue';
import { std, stdurl } from '/src/std.ts';
import CloudTAKFeatView from './FeatView.vue';
import {
    IconSearch,
    IconMessage,
    IconLocationOff,
    IconLocation,
    IconMenu2,
    IconPlus,
    IconMinus,
    IconFocus2,
    IconLockAccess,
    IconPencil,
    IconX,
    IconPoint,
    IconLine,
    IconPolygon,
    IconCursorText,
    IconVector,
    IconBell,
    IconCircleArrowUp,
} from '@tabler/icons-vue';
import SelectFeats from './util/SelectFeats.vue';
import MultipleSelect from './util/MultipleSelect.vue';
import SideMenu from './Menu.vue';
import {
    TablerDropdown,
    TablerModal,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import Loading from './Loading.vue';
import 'maplibre-gl/dist/maplibre-gl.css';
import RadialMenu from './RadialMenu/RadialMenu.vue';
import { mapState, mapActions } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
import { useProfileStore } from '/src/stores/profile.ts';
import { useCOTStore } from '/src/stores/cots.ts';
import { useConnectionStore } from '/src/stores/connection.ts';
import UploadImport from './util/UploadImport.vue'
const profileStore = useProfileStore();
const cotStore = useCOTStore();
const mapStore = useMapStore();
const connectionStore = useConnectionStore();

export default {
    name: 'CloudTAK',
    props: {
        user: {
            type: Object,
            required: true
        }
    },
    computed: {
        ...mapState(useMapStore, ['bearing', 'select', 'radial', 'isLoaded', 'selected']),
        ...mapState(useProfileStore, ['profile', 'notifications']),
        humanBearing: function() {
            if (this.bearing < 0) {
                return Math.round(this.bearing * -1) + '°'
            } else {
                return Math.round(360 - this.bearing) + '°';
            }
        },
        noMenuShown: function() {
            return !this.feat && !this.pointInput && !this.$route.name.startsWith('home-menu')
        }
    },
    watch: {
        'radial.cot': function() {
            if (mapStore.radial.cot) {
                mapStore.map.scrollZoom.disable();
                mapStore.map.touchZoomRotate.disableRotation();
                mapStore.map.dragRotate.disable();
                mapStore.map.dragPan.disable();
                this.locked.push(mapStore.radial.cot.properties.id);
            } else {
                mapStore.map.scrollZoom.enable();
                mapStore.map.touchZoomRotate.enableRotation();
                mapStore.map.dragRotate.enable();
                mapStore.map.dragPan.enable();
                this.locked.pop();
            }
        },
        'search.filter': async function() {
            await this.fetchSearch();
        },
    },
    unmounted: function() {
        cotStore.$reset();
        mapStore.destroy();
    },
    mounted: async function() {
        // ensure uncaught errors in the stack are captured into vue context
        window.addEventListener('error', (evt) => {
            evt.preventDefault();
            this.$emit('err', new Error(evt.message));
        });

        await this.mountMap();

        await Promise.all([
            profileStore.loadChannels(),
            cotStore.loadArchive()
        ]);

        this.warnChannels = profileStore.hasNoChannels;

        this.loading.main = false;

        window.addEventListener('dragover', (e) => {
            e.preventDefault();

            const dt = e.dataTransfer;
            if (dt.types && (dt.types.indexOf ? dt.types.indexOf('Files') != -1 : dt.types.contains('Files'))) {
                this.upload.shown = true;
                this.upload.dragging = true;
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key == 'Escape') {
                if (mapStore.radial.mode) {
                    this.closeRadial()
                } else if (mapStore.select.feats) {
                    mapStore.select.feats = [];
                } else if (this.$route.path.startsWith("/")) {
                    this.$router.push("/");
                }
            }
        });

        connectionStore.connectSocket(this.user.email);
    },
    data: function() {
        return {
            mode: 'Default',
            warnChannels: false,        // Show a popup if no channels are selected on load
            search: {
                shown: false,
                filter: '',
                results: []
            },
            pointInput: false,
            feat: null,         // Show the Feat Viewer sidebar
            locked: [],         // Lock the map view to a given CoT - The last element is the currently locked value
                                //   this is an array so that things like the radial menu can temporarily lock state but remember the previous lock value when they are closed
            upload: {
                shown: false,
                dragging: false
            },
            timer: null,        // Interval for pushing GeoJSON Map Updates (CoT)
            timerSelf: null,    // Interval for pushing your location to the server
            loading: {
                // Any Loading related states
                main: true
            },
            iconsets: { total: 0, items: [] },
        }
    },
    beforeUnmount: function() {
        if (this.timer) window.clearInterval(this.timer);
        if (this.timerSelf) window.clearInterval(this.timerSelf);
        if (connectionStore.ws) connectionStore.ws.close();

        if (mapStore.map) {
            mapStore.map.remove();
        }
    },
    methods: {
        ...mapActions(useProfileStore, ['clearNotifications']),
        closeAllMenu: function() {
            this.feat = false;
            this.$router.push("/");
            this.pointInput = false;
        },
        closeRadial: function() {
            mapStore.radial.mode = null;
            mapStore.radial.cot = null;
        },
        toLocation: function() {
            if (!profileStore.profile.tak_loc) throw new Error('No Location Set');
            mapStore.map.flyTo({
                center: profileStore.profile.tak_loc.coordinates,
                zoom: 14
            });
        },
        setLocation: function() {
            this.mode = 'SetLocation';
            mapStore.map.getCanvas().style.cursor = 'pointer'
            mapStore.map.once('click', async (e) => {
                mapStore.map.getCanvas().style.cursor = ''
                this.mode = 'Default';
                await profileStore.update({
                    tak_loc: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] }
                })
                this.setYou();
            });
        },
        fileUpload: function(event) {
            this.upload.shown = false;
            const imp = JSON.parse(event);
            this.$router.push(`/menu/imports/${imp.id}`)
        },
        fetchSearch: async function(query, magicKey) {
            if (!magicKey) {
                const url = stdurl('/api/search/suggest');
                url.searchParams.append('query', this.search.filter);
                this.search.results = (await std(url)).items;
            } else {
                const url = stdurl('/api/search/forward');
                url.searchParams.append('query', query);
                url.searchParams.append('magicKey', magicKey);
                const items = (await std(url)).items;

                this.search.shown = false;
                this.search.filter = '';
                this.search.results = [];

                if (items.length) {
                    mapStore.map.fitBounds([
                        [items[0].extent.xmin, items[0].extent.ymin],
                        [items[0].extent.xmax, items[0].extent.ymax],
                    ], {
                        duration: 0,
                        padding: {top: 25, bottom:25, left: 25, right: 25}
                    });
                }
            }
        },
        setBearing: function(bearing=0) {
            mapStore.map.setBearing(bearing);
        },
        setZoom: function(zoom) {
            mapStore.map.setZoom(zoom);
        },
        getZoom: function() {
            return mapStore.map.getZoom();
        },
        getLocation: function() {
            if (!("geolocation" in navigator)) throw new Error('GeoLocation is not available in this browser');

            navigator.geolocation.getCurrentPosition((position) => {
                mapStore.map.flyTo({
                    center: [position.coords.longitude, position.coords.latitude],
                    zoom: 14
                });
            });
        },
        startDraw: function(type) {
            mapStore.draw.start();
            mapStore.draw.setMode(type);
        },
        handleRadial: async function(event) {
            if (event === 'cot:view') {
                this.$router.push(`/cot/${this.radial.cot.id}`);
                this.closeRadial()
            } else if (event === 'cot:delete') {
                const cot = mapStore.radial.cot;
                this.closeRadial()

                if (this.$route.name === 'home-menu-cot' && this.$route.params.uid === cot.id) {
                    this.$router.push('/');
                }

                await this.deleteCOT(cot);
            } else if (event === 'cot:edit') {
                this.editGeometry(mapStore.radial.cot);
                this.closeRadial()
            } else if (event === 'feat:view') {
                this.feat = this.radial.cot;
                this.closeRadial()
            } else if (event === 'context:new') {
                await cotStore.add(mapStore.radial.cot);
                this.updateCOT();
                this.closeRadial()
            } else if (event === 'context:info') {
                this.$router.push(`/query/${encodeURIComponent(this.radial.cot.geometry.coordinates.join(','))}`);
                this.closeRadial()
            } else {
                this.closeRadial()
                throw new Error(`Unimplemented Radial Action: ${event}`);
            }
        },
        editGeometry: function(cot) {
            mapStore.edit = cot;
            mapStore.draw.start();
            mapStore.draw.setMode('select');
            const feat = cotStore.get(cot.id, { clone: true });

            if (feat.geometry.type === 'Polygon') {
                feat.properties.mode = 'polygon';
            } else if (feat.geometry.type === 'LineString') {
                feat.properties.mode = 'linestring';
            } else if (feat.geometry.type === 'Point') {
                feat.properties.mode = 'point';

                // TODO: Eventually retain if unchanged or just drop, not sure what's best
                if (feat.geometry.coordinates.length > 2) {
                    feat.geometry.coordinates.splice(2);
                }
            }

            cotStore.hidden.add(feat.id);
            this.updateCOT();
            mapStore.draw.addFeatures([feat]);
            mapStore.draw.selectFeature(feat.id);
        },
        deleteCOT: async function(cot) {
            if (cot) {
                await cotStore.delete(cot.properties.id)
            } else {
                cotStore.clear();
            }
            await this.updateCOT();
        },
        updateCOT: async function() {
            try {
                const diff = cotStore.diff();

                for (const cot of cotStore.pending.values()) {
                    if (cotStore.cots.has(cot.id)) {
                        diff.update.push({
                            id: cot.id,
                            addOrUpdateProperties: Object.keys(cot.properties).map((key) => {
                                return { key, value: cot.properties[key] }
                            }),
                            newGeometry: cot.geometry
                        })
                    } else {
                        diff.add.push(cot);
                    }

                    cotStore.cots.set(cot.id, cot);
                }

                cotStore.pending.clear();

                for (const id of cotStore.pendingDelete) {
                    diff.remove.push(id);
                    cotStore.cots.delete(id);
                }

                cotStore.pendingDelete.clear();

                if (diff.add.length || diff.remove.length || diff.update.length) {
                    mapStore.map.getSource('-1').updateData(diff);
                }

                if (this.locked.length && cotStore.has(this.locked[this.locked.length - 1])) {
                    const flyTo = {
                        center: cotStore.get(this.locked[this.locked.length - 1]).properties.center,
                        speed: Infinity
                    };
                    mapStore.map.flyTo(flyTo);

                    if (mapStore.radial.mode) {
                        mapStore.radial.x = mapStore.container ? mapStore.container.clientWidth / 2 : 0;
                        mapStore.radial.y = mapStore.container ? mapStore.container.clientHeight / 2 : 0;
                    }
                }
            } catch (err) {
                console.error(err);
            }
        },
        setYou: function() {
            if (profileStore.profile.tak_loc) {
                connectionStore.sendCOT(profileStore.CoT());
                mapStore.map.getSource('0').setData({
                    type: 'FeatureCollection',
                    features: [{
                        type: 'Feature',
                        properties: {},
                        geometry: profileStore.profile.tak_loc
                    }]
                });
            }
        },
        mountMap: async function() {
            mapStore.init(this.$refs.map);

            mapStore.map.once('idle', async () => {
                // Eventually make a sprite URL part of the overlay so KMLs can load a sprite package
                const iconsets = await std('/api/iconset');
                for (const iconset of iconsets.items) {
                    mapStore.map.addSprite(iconset.uid, String(stdurl(`/api/icon/sprite?token=${localStorage.token}&iconset=${iconset.uid}`)))
                }

                await mapStore.initOverlays();
                mapStore.initDraw();

                this.setYou();

                mapStore.draw.on('deselect', async () => {
                    if (!mapStore.edit) return;

                    const feat = mapStore.draw._store.store[mapStore.edit.id];
                    delete feat.properties.center;

                    cotStore.hidden.delete(mapStore.edit.id);

                    mapStore.edit = null

                    mapStore.draw.setMode('static');
                    mapStore.draw.stop();

                    cotStore.cots.delete(feat.id);
                    cotStore.add(feat);
                    await this.updateCOT();
                })

                mapStore.draw.on('finish', async (id) => {
                    if (mapStore.draw.getMode() === 'select' || mapStore.edit) {
                        return;
                    }

                    const geometry = mapStore.draw._store.store[id].geometry;

                    const feat = {
                        id: id,
                        type: 'Feature',
                        how: 'h-g-i-g-o',
                        properties: {
                            archived: true,
                            callsign: 'New Feature'
                        },
                        geometry
                    };

                    if (mapStore.draw.getMode() === 'polygon' || mapStore.draw.getMode() === 'rectangle') {
                        feat.properties.type = 'u-d-f';
                    } else if (mapStore.draw.getMode() === 'linestring') {
                        feat.properties.type = 'u-d-f';
                    } else if (mapStore.draw.getMode() === 'point') {
                        feat.properties.type = 'u-d-p';
                        feat.properties["marker-opacity"] = 1;
                        feat.properties["marker-color"] = '#00FF00';
                    }

                    mapStore.draw._store.delete([id]);
                    mapStore.draw.setMode('static');
                    mapStore.draw.stop();
                    await cotStore.add(feat);
                    await this.updateCOT();
                });

                this.timerSelf = window.setInterval(() => {
                    if (profileStore.profile.tak_loc) {
                        connectionStore.sendCOT(profileStore.CoT());
                    }
                }, 2000);

                this.timer = window.setInterval(async () => {
                    if (!mapStore.map) return;
                    await this.updateCOT();
                }, 500);
            });
        }
    },
    components: {
        CoordInput,
        WarnChannels,
        SideMenu,
        Loading,
        SelectFeats,
        MultipleSelect,
        UploadImport,
        RadialMenu,
        TablerNone,
        TablerInput,
        TablerModal,
        TablerDropdown,
        IconSearch,
        IconMessage,
        IconLocationOff,
        IconLocation,
        IconMinus,
        IconBell,
        IconPlus,
        IconFocus2,
        IconLockAccess,
        IconPoint,
        IconLine,
        IconPolygon,
        IconVector,
        IconMenu2,
        IconPencil,
        CloudTAKFeatView,
        IconCursorText,
        IconCircleArrowUp,
        IconX,
    }
}
</script>
