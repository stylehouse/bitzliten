<script lang="ts">
    import { tweened } from 'svelte/motion';
    import { dec } from '../ff/FFgemp';

    // a needle
    let {ne = $bindable()} = $props();
    // they needle.left.set(value) etc
    let left = tweened(0,{duration:0})
    let top = tweened(0,{duration:0})
    let opacity = tweened(0,{duration:0})
    ne.set_tweens({left,top,opacity})
    
    let spanclass = ne.mirror ? 'mirror' : ''
</script>

<soundneedle style="
    left:{$left}px;
    top:{$top}px;
    opacity:{dec($opacity,3)};
    ">
    
    <span class={spanclass}>
        <img src="pointer.webp" />
    </span>
</soundneedle>

<style>
    soundneedle {
        position:absolute;
        mix-blend-mode: color-dodge;
        pointer-events:none;
        margin-left:-1em;
    }
    soundneedle span.mirror {
        position:absolute;
        transform: scaleX(-1);
    }
    soundneedle span.mirror img {
        margin-right: -20em;
    }
    img {
        margin-top: -7em;
        margin-left: -7em;
    }
</style>