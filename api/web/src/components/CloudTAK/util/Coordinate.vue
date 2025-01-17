<template>
    <div class='col-12'>
        <label
            class='subheader mx-2'
            v-text='label'
        />
        <div class='mx-2'>
            <CopyField
                :modelValue='inMode'
                @update:modelValue=''
                :edit='edit && mode === "dd"'
                :hover='hover && mode === "dd"'
                :validate='validateInput'
                :size='24'
            />
            <template v-if='modes.length'>
                <div role='menu'>
                    <span
                        v-if='modes.includes("dd")'
                        v-tooltip='"Decimal Degrees"'
                        role='menuitem'
                        tabindex='0'
                        class='my-1 px-2'
                        :class='{
                            "bg-gray-500 rounded-bottom": mode === "dd",
                            "cursor-pointer": mode !== "dd",
                        }'
                        @click='mode = "dd"'
                    >DD</span>
                    <span
                        v-if='modes.includes("dms")'
                        v-tooltip='"Decimal Minutes Seconds"'
                        class='my-1 px-2'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-gray-500 rounded-bottom": mode === "dms",
                            "cursor-pointer": mode !== "dms",
                        }'
                        @click='mode = "dms"'
                    >DMS</span>
                    <span
                        v-if='modes.includes("mgrs")'
                        v-tooltip='"Military Grid Reference System"'
                        class='my-1 px-2'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-gray-500 rounded-bottom": mode === "mgrs",
                            "cursor-pointer": mode !== "mgrs",
                        }'
                        @click='mode = "mgrs"'
                    >MGRS</span>
                    <span
                        v-if='modes.includes("utm")'
                        v-tooltip='"Universal Transverse Mercator"'
                        class='my-1 px-2'
                        role='menuitem'
                        tabindex='0'
                        :class='{
                            "bg-gray-500 rounded-bottom": mode === "utm",
                            "cursor-pointer": mode !== "utm",
                        }'
                        @click='mode = "utm"'
                    >UTM</span>
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import {
    TablerInput
} from '@tak-ps/vue-tabler';
import CopyField from './CopyField.vue';

export default {
    name: 'COTCoordinate',
    components: {
        TablerInput,
        CopyField,
    },
    props: {
        label: {
            type: String,
            default: 'Coordinates'
        },
        hover: {
            type: Boolean,
            default: false
        },
        edit: {
            type: Boolean,
            default: false
        },
        truncate: {
            type: Number,
            description: 'Truncate DD coordinates to a given precision'
        },
        modes: {
            type: Array,
            default: function() {
                return ['dd', 'dms', 'mgrs', 'utm']
            }
        },
        modelValue: {
            type: Array,
            required: true,
            description: 'A coordinate pair in GeoJSON format (lng,lat)'
        }
    },
    emits: [
        'update:modelValue',
        'submit'
    ],
    data: function() {
        return {
            mode: 'dd',
            coordinateEntry: [this.modelValue[1], this.modelValue[0]].join(',')
        }
    },
    computed: {
        validateInput: function() {
            return (text) => {
                if (this.mode === 'dd') {
                    const dd = text.split(',').map((d) => {
                        return Number(d.trim())
                    });

                    const errors = [];
                    if (dd.length !== 2) errors.push('Must have contain latitude,longitude');
                    if (isNaN(dd[0])) errors.push('First number (latitude) is not a number');
                    if (isNaN(dd[1])) errors.push('Second number (longitude) is not a number');

                    return errors.length ? errors[0] : true;
                } else {
                    return false;
                }
            }
        },
        inMode: function() {
            if (this.mode === 'dd') {
                if (this.truncate) {
                    return [
                        Math.trunc(this.modelValue[1] * Math.pow(10, this.truncate)) / Math.pow(10, this.truncate),
                        Math.trunc(this.modelValue[0] * Math.pow(10, this.truncate)) / Math.pow(10, this.truncate)
                    ].join(', ');
                } else {
                    return `${this.modelValue[1]}, ${this.modelValue[0]}`;
                }
            } else if (this.mode === 'dms') {
                return `${this.asDMS(this.modelValue[1])}, ${this.asDMS(this.modelValue[0])}`;
            } else if (this.mode === 'mgrs') {
                return this.asMGRS();
            } else if (this.mode === 'utm') {
                return this.asUTM(this.modelValue[1], this.modelValue[0]);
            }

            return 'UNKNOWN'
        }
    },
    watch: {
        coordinateEntry: function() {
            this.$emit('update:modelValue', this.coordinateEntry
                .split(',')
                .map((c) => Number(c.trim()))
                .reverse()
            );
        }
    },
    methods: {
        // WRONG!!!!
        asDMS: function(dd) {
            const deg = dd | 0;
            const frac = Math.abs(dd - deg);
            const min = (frac * 60) | 0;
            const sec = frac * 3600 - min * 60;
            return deg + '° ' + min + '\' ' + Math.floor(sec + 100) / 100 + '"';
        },
        asUTM: function(latitude, longitude) {
            if (latitude > 84 || latitude < -80) {
                throw new RangeError('latitude out of range (must be between 80 deg S and 84 deg N)');
            }
            if (longitude > 180 || longitude < -180) {
                throw new RangeError('longitude out of range (must be between 180 deg W and 180 deg E)');
            }

            var K0 = 0.9996;

            var E = 0.00669438;
            var E2 = Math.pow(E, 2);
            var E3 = Math.pow(E, 3);
            var E_P2 = E / (1 - E);

            var M1 = 1 - E / 4 - 3 * E2 / 64 - 5 * E3 / 256;
            var M2 = 3 * E / 8 + 3 * E2 / 32 + 45 * E3 / 1024;
            var M3 = 15 * E2 / 256 + 45 * E3 / 1024;
            var M4 = 35 * E3 / 3072;

            var R = 6378137;

            const latRad = this.toRadians(latitude);
            const latSin = Math.sin(latRad);
            const latCos = Math.cos(latRad);

            const latTan = Math.tan(latRad);
            const latTan2 = Math.pow(latTan, 2);
            const latTan4 = Math.pow(latTan, 4);

            const zoneNum = this.latLonToZoneNumber(latitude, longitude);
            const zoneLetter = this.latitudeToZoneLetter(latitude);

            const lonRad = this.toRadians(longitude);
            const centralLon = this.zoneNumberToCentralLongitude(zoneNum);
            const centralLonRad = this.toRadians(centralLon);

            const n = R / Math.sqrt(1 - E * latSin * latSin);
            const c = E_P2 * latCos * latCos;

            const a = latCos * (lonRad - centralLonRad);
            const a2 = Math.pow(a, 2);
            const a3 = Math.pow(a, 3);
            const a4 = Math.pow(a, 4);
            const a5 = Math.pow(a, 5);
            const a6 = Math.pow(a, 6);

            const m = R * (M1 * latRad -
                M2 * Math.sin(2 * latRad) +
                M3 * Math.sin(4 * latRad) -
                M4 * Math.sin(6 * latRad));
            let easting = K0 * n * (a +
                a3 / 6 * (1 - latTan2 + c) +
                a5 / 120 * (5 - 18 * latTan2 + latTan4 + 72 * c - 58 * E_P2)) + 500000;
            let northing = K0 * (m + n * latTan * (a2 / 2 +
                a4 / 24 * (5 - latTan2 + 9 * c + 4 * c * c) +
                a6 / 720 * (61 - 58 * latTan2 + latTan4 + 600 * c - 330 * E_P2)));
            if (latitude < 0) northing += 1e7;

            return `${zoneNum}${zoneLetter} ${Math.floor(easting)} ${Math.floor(northing)}`;
        },
        zoneNumberToCentralLongitude: function(zoneNum) {
          return (zoneNum - 1) * 6 - 180 + 3;
          },
        toRadians: function(deg) {
            return deg * Math.PI / 180;
        },
        latitudeToZoneLetter: function(latitude) {
            const ZONE_LETTERS = 'CDEFGHJKLMNPQRSTUVWXX';
            if (-80 <= latitude && latitude <= 84) {
                return ZONE_LETTERS[Math.floor((latitude + 80) / 8)];
            } else {
                return null;
            }
        },
        latLonToZoneNumber: function(latitude, longitude) {
            if (56 <= latitude && latitude < 64 && 3 <= longitude && longitude < 12) return 32;

            if (72 <= latitude && latitude <= 84 && longitude >= 0) {
                if (longitude <  9) return 31;
                if (longitude < 21) return 33;
                if (longitude < 33) return 35;
                if (longitude < 42) return 37;
            }

            return Math.floor((longitude + 180) / 6) + 1;
        },
        asMGRS: function() {
            const Lat = this.modelValue[1];
            const Long = this.modelValue[0];
            if (Lat < -80) return 'Too far South' ; if (Lat > 84) return 'Too far North' ;
            const c = 1 + Math.floor ((Long+180)/6);
            const e = c*6 - 183 ;
            const k = Lat*Math.PI/180;
            const l = Long*Math.PI/180;
            const m = e*Math.PI/180;
            const n = Math.cos (k);
            const o = 0.006739496819936062*Math.pow (n,2);
            const p = 40680631590769/(6356752.314*Math.sqrt(1 + o));
            const q = Math.tan (k);
            const r = q*q;
            const t = l - m;
            const u = 1.0 - r + o;
            const v = 5.0 - r + 9*o + 4.0*(o*o);
            const w = 5.0 - 18.0*r + (r*r) + 14.0*o - 58.0*r*o;
            const x = 61.0 - 58.0*r + (r*r) + 270.0*o - 330.0*r*o;
            const y = 61.0 - 479.0*r + 179.0*(r*r) - (r*r*r);
            const z = 1385.0 - 3111.0*r + 543.0*(r*r) - (r*r*r);
            let aa = p*n*t + (p/6.0*Math.pow (n,3)*u*Math.pow (t,3)) + (p/120.0*Math.pow (n,5)*w*Math.pow (t,5)) + (p/5040.0*Math.pow (n,7)*y*Math.pow (t,7));
            let ab = 6367449.14570093*(k - (0.00251882794504*Math.sin (2*k)) + (0.00000264354112*Math.sin (4*k)) - (0.00000000345262*Math.sin (6*k)) + (0.000000000004892*Math.sin (8*k))) + (q/2.0*p*Math.pow (n,2)*Math.pow (t,2)) + (q/24.0*p*Math.pow (n,4)*v*Math.pow (t,4)) + (q/720.0*p*Math.pow (n,6)*x*Math.pow (t,6)) + (q/40320.0*p*Math.pow (n,8)*z*Math.pow (t,8));
            aa = aa*0.9996 + 500000.0;
            ab = ab*0.9996; if (ab < 0.0) ab += 10000000.0;
            const ad = 'CDEFGHJKLMNPQRSTUVWXX'.charAt (Math.floor (Lat/8 + 10));
            const ae = Math.floor (aa/100000);
            const af = ['ABCDEFGH','JKLMNPQR','STUVWXYZ'][(c-1)%3].charAt (ae-1);
            const ag = Math.floor (ab/100000)%20;
            const ah = ['ABCDEFGHJKLMNPQRSTUV','FGHJKLMNPQRSTUVABCDE'][(c-1)%2].charAt (ag);
            function pad (val) {if (val < 10) {val = '0000' + val} else if (val < 100) {val = '000' + val} else if (val < 1000) {val = '00' + val} else if (val < 10000) {val = '0' + val}return val}
            aa = Math.floor (aa%100000); aa = pad (aa);
            ab = Math.floor (ab%100000); ab = pad (ab);
            return c + ad + ' ' + af + ah + ' ' + aa + ' ' + ab;
        }
    }
}
</script>
