<script lang="ts">
    // < goes horizontally
    // < accepts ZoneFile with duration

    import Knob from "./Knob.svelte";

    let {
        value=$bindable(5),
        
        ...props
    } = $props()

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

    bind:grabbed={grabbed}
    
    {...props} />

<style>
    span {
        position:absolute;
        right:0px;
    }
</style>