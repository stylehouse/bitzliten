<script>
	import { fade,scale } from 'svelte/transition';
    let {cuelets,cuelet_class,cuelet_info} = $props()
</script>

<div>
{#each cuelets as cuelet (cuelet.in)}
<!-- transition:scale -->
    <soundbox 
    transition:scale
        class={cuelet_class(cuelet)}
        bind:this={cuelet.el}
        >
        &nbsp; {cuelet_info(cuelet)}
    </soundbox>
{/each}
</div>

<style>
    div {
        filter: hue-rotate(30deg)
    }
</style>