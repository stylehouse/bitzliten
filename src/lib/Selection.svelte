<script>
    import Schaud from "./Schaud.svelte";

    let {sel,needle_uplink} = $props()

    let playlets = $state([])
    $effect(() => {
        playlets = sel.playlets || []
    })

    let magico = $state('')
</script>

<p> selection:{sel.id}
    {#if playlets.length}
        <Schaud {playlets} {needle_uplink} {sel}
            bind:magic={magico}
            />
        <p>BTW: {magico}</p>
    {:else}
        <p>...</p>
    {/if}
 </p>