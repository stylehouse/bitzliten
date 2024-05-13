<script lang="ts">
    // < goes horizontally
    // < accepts ZoneFile with duration

    import Knob from "./Knob.svelte";

    let {
        value=$bindable(5),
        // 20ms at a time
        step=0.02,

        ...props
    } = $props()

    // to input "1:04" -> 64
    function interpret_type(v) {
        let hms = `${v}`.split(':').reverse()
        v = hms.shift()
        // + minutes, hours
        if (hms.length) v += hms.shift()*60
        if (hms.length) v += hms.shift()*60*60
        if (hms.length) throw "bad h:m:s"
        return v*1
    }

    // it comes to us
    let knobval = $state(value)
    $effect(() => {
        value = knobval
    })
    $effect(() => {
        knobval = value
    })

    let grabbed = $state()
</script>

{#if grabbed}
    <span>GRABBED</span>
{/if}
<span style="margin:1em">{value}</span>

<Knob 
    bind:value={knobval}
    {step}

    bind:grabbed={grabbed}
    {interpret_type}
    
    {...props} />

<style>
    span {
        position:absolute;
        right:0px;
    }
</style>