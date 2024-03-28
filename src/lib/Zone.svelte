<script lang="ts" module>
    import { FFgemp,fetch } from "./FFgemp"
    import { onMount } from "svelte";
    import Knob from "./Knob.svelte";

    let FF = new FFgemp()
    let message = $state('');
    FF.on('message',(s) => message = s)
    // the config
    let modes = $state()
    // the input
    let file = $state()
    onMount(async () => {
        await FF.init()
        modes = FF.modes
        file = 'aliomar.mp3'
        // letsgo()
    });


    let transcoded:any = $state()

    function handleDrop(e) {
        e.preventDefault();
        file = e.dataTransfer.files[0];
        letsgo()
    }
    let pending = $state()
    let last_config
    async function letsgo() {
        // if differently configured
        let new_config = JSON.toString(modes)
        if (new_config == last_config) return
        last_config = new_config

        // wait for it
        pending = 1
        let result = await FF.transcode(file)
        transcoded = URL.createObjectURL(result)
        pending = 0
    }
    let playerel = $state()
    let player = $derived(playerel && playerel.v)
    $effect(() => {
        if (player) {
            player.play()
        }
    })

    $effect(() => {
        if (modes) {
            letsgo()
        }
    })





	// let source_video: HTMLVideoElement;
    // source_video.src = URL.createObjectURL(file);
    

    function handleDragOver(e) {
        e.preventDefault();
    }
</script>

<main>
    <p>{message}</p>
    <div
        on:drop={handleDrop}
        on:dragover={handleDragOver}
        class="drop-zone"
        role="dropzone"
        aria-dropeffect="execute"
        style="border: 2px dashed #ccc; padding: 20px; text-align: center;"
    >
        {#if !transcoded}
            <p>
                Drag and drop an audio file here to transcode to 40kbps Opus
                format.
            </p>
        {:else}
            <video src={transcoded}
                 bind:this={playerel}
                 autoplay loop controls/>
        {/if}

    </div>
    <div>
        {#if modes}
            {#each modes as m (m.t)}
                <mode>{m.t}
                {#if m.max}
                    <Knob min={m.min} max={m.max} bind:value={m.s} />
                {:else if m.s != null}
                    ={m.s}
                {/if}
                </mode>
            {/each}
            <mode on:click={letsgo}>AGAIN</mode>
            {#if pending}<mode>PENDING</mode>{/if}
        {/if}
    </div>
</main>
<style>
    p {
        border: 3px solid sandybrown;
        border-radius: 3em;
        padding: 1em;
    }
    mode {
        border: 3px solid rgb(30, 86, 100);
        border-radius: 2em;
        padding: 1em;

    }
</style>