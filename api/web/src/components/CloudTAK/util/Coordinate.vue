<template>
<div class='col-12'>
    <label class='subheader'>Coordinate</label>
    <div class='mx-2'>
        <div
            v-text='inMode'
            class='bg-gray-500 rounded-top py-2 px-2'
        />
        <span
            @click='mode = "dd"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "dd",
                "cursor-pointer": mode !== "dd",
            }'
            v-tooltip='"Decimal Degrees"'
        >DD</span>
        <span
            @click='mode = "dms"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "dms",
                "cursor-pointer": mode !== "dms",
            }'
            v-tooltip='"Decimal Minutes Seconds"'
        >DMS</span>
        <span
            @click='mode = "mgrs"'
            class='my-1 px-2'
            :class='{
                "bg-gray-500 rounded-bottom": mode === "mgrs",
                "cursor-pointer": mode !== "mgrs",
            }'
            v-tooltip='"Military Grid Reference System"'
        >MGRS</span>
    </div>
</div>
</template>

<script>
export default {
    name: 'Coordinate',
    props: {
        coordinates: {
            type: Array,
            required: true
        }
    },
    computed: {
        inMode: function() {
            if (this.mode === 'dd') return this.coordinates.join(", ");
            else if (this.mode === 'mgrs') return this.asMGRS();
        }
    },
    data: function() {
        return {
            mode: 'dd',
        }
    },
    methods: {
        asDMS: function() (dd) {
            var deg = dd | 0; // truncate dd to get degrees
            var frac = Math.abs(dd - deg); // get fractional part
            var min = (frac * 60) | 0; // multiply fraction by 60 and truncate
            var sec = frac * 3600 - min * 60;
            return deg + "d " + min + "' " + sec + "\"";
        },
        asMGRS: function() {
            const Lat = this.coordinates[1];
            const Long = this.coordinates[0];
            if (Lat < -80) return 'Too far South' ; if (Lat > 84) return 'Too far North' ;
            var c = 1 + Math.floor ((Long+180)/6);
            var e = c*6 - 183 ;
            var k = Lat*Math.PI/180;
            var l = Long*Math.PI/180;
            var m = e*Math.PI/180;
            var n = Math.cos (k);
            var o = 0.006739496819936062*Math.pow (n,2);
            var p = 40680631590769/(6356752.314*Math.sqrt(1 + o));
            var q = Math.tan (k);
            var r = q*q;
            var s = (r*r*r) - Math.pow (q,6);
            var t = l - m;
            var u = 1.0 - r + o;
            var v = 5.0 - r + 9*o + 4.0*(o*o);
            var w = 5.0 - 18.0*r + (r*r) + 14.0*o - 58.0*r*o;
            var x = 61.0 - 58.0*r + (r*r) + 270.0*o - 330.0*r*o;
            var y = 61.0 - 479.0*r + 179.0*(r*r) - (r*r*r);
            var z = 1385.0 - 3111.0*r + 543.0*(r*r) - (r*r*r);
            var aa = p*n*t + (p/6.0*Math.pow (n,3)*u*Math.pow (t,3)) + (p/120.0*Math.pow (n,5)*w*Math.pow (t,5)) + (p/5040.0*Math.pow (n,7)*y*Math.pow (t,7));
            var ab = 6367449.14570093*(k - (0.00251882794504*Math.sin (2*k)) + (0.00000264354112*Math.sin (4*k)) - (0.00000000345262*Math.sin (6*k)) + (0.000000000004892*Math.sin (8*k))) + (q/2.0*p*Math.pow (n,2)*Math.pow (t,2)) + (q/24.0*p*Math.pow (n,4)*v*Math.pow (t,4)) + (q/720.0*p*Math.pow (n,6)*x*Math.pow (t,6)) + (q/40320.0*p*Math.pow (n,8)*z*Math.pow (t,8));
            aa = aa*0.9996 + 500000.0;
            ab = ab*0.9996; if (ab < 0.0) ab += 10000000.0;
            var ad = 'CDEFGHJKLMNPQRSTUVWXX'.charAt (Math.floor (Lat/8 + 10));
            var ae = Math.floor (aa/100000);
            var af = ['ABCDEFGH','JKLMNPQR','STUVWXYZ'][(c-1)%3].charAt (ae-1);
            var ag = Math.floor (ab/100000)%20;
            var ah = ['ABCDEFGHJKLMNPQRSTUV','FGHJKLMNPQRSTUVABCDE'][(c-1)%2].charAt (ag);
            function pad (val) {if (val < 10) {val = '0000' + val} else if (val < 100) {val = '000' + val} else if (val < 1000) {val = '00' + val} else if (val < 10000) {val = '0' + val};return val};
            aa = Math.floor (aa%100000); aa = pad (aa);
            ab = Math.floor (ab%100000); ab = pad (ab);
            return c + ad + ' ' + af + ah + ' ' + aa + ' ' + ab;
        }
    }
}
</script>
