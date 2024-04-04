<script lang="ts" module>
    import { FFgemp } from "./FFgemp"
    import Knob from "./Knob.svelte";
    // < 2s chunks
    // < lots of them together, buffering
    // < loop end adjustment
    //  < with visual...

    let FF = new FFgemp()
    let message = $state('');
    FF.on('message',(s) => message = s)
    // the config
    let modes = $state()
    // the input
    let file = $state()
    $effect(async () => {
        await FF.init()
        modes = FF.modes
        if ('auto') {
            file = 'aliomar.mp3'
            letsgo()
        }
    });


    let transcoded:any = $state()

    let pending = $state()
    let last_config = $state()
    async function letsgo() {
        // if differently configured
        let new_config = JSON.stringify(modes)
        if (new_config == last_config) return

        if (pending) {
            // < stop it
            //    might be much faster to do 2s chunks?
            // tell current job to start again when done
            pending = 2
            return
        }
        pending = 1
        let result = await FF.transcode(file)
        transcoded = URL.createObjectURL(result)
        if (pending == 2) {
            // we tried to start a job while working on this one, so start again
            setTimeout(() => letsgo(),1)
        }
        pending = 0
        last_config = new_config
    }
    function config_maybe_changed() {
        letsgo()
    }


    let playerel = $state()
    $effect(() => {
        if (playerel) {
            playerel.play()
        }
    })

    // all the Knobs call this when adjusted
    let commit = () => {
    }
    
    $effect(() => {
        if (modes && file) {
            letsgo()
        }
    })





	// let source_video: HTMLVideoElement;
    // source_video.src = URL.createObjectURL(file);
    

    function handleDrop(e) {
        e.preventDefault();
        file = e.dataTransfer.files[0];
        letsgo()
    }
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
                    <Knob min={m.min} max={m.max} 
                        bind:value={m.s} 
                        commit={config_maybe_changed} />
                {:else if m.s != null}
                    ={m.s}
                {/if}
                </mode>
            {/each}
            <mode on:click={letsgo}>AGAIN</mode>
            {#if pending}<mode>PENDING</mode>{/if}
            <p>cmds: {last_config}</p>
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