<script lang=ts>
    import { Fili, Sele,create_unfulfilled_dublets } from "./cuelet_precursor.svelte";
    let {fil,onload} = $props()

    $effect(() => {
        // class Fili does stuff
        fil.wake({onload})
    })
</script>

File: {fil.name}