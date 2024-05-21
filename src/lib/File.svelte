<script lang=ts>
    import { Fili, Sele,create_unfulfilled_dublets } from "./cuelet_precursor.svelte";
    let {fil,onload} = $props()

    $effect(() => {
        // class Fili does stuff
        fil.wake({onload})
    })
</script>

<ce>
    <hi>File:</hi> <va>{fil.name}</va>


    {#if fil.type}
        <ce><hi>type</hi> <va>{fil.type}</va></ce>
    {/if}
</ce>

<style>
    hi {
        color: white;
        font-weight:600;
    }
    va {
        max-width:10em;
    }
    ce {
        margin: 1em
    }
</style>