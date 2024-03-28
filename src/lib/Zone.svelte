<script lang="ts" module>
    import { FFgemp } from "$lib/FFgemp"
    import { onMount } from "svelte";

    let FF = new FFgemp()
    let message;
    FF.on('message',(s) => message = s)
    onMount(() => FF.init());


    let transcoded:any;


    let file
    function handleDrop(e) {
        e.preventDefault();
        file = e.dataTransfer.files[0];
        FF.transcode(file).then((result) => {
            transcoded = URL.createObjectURL(result);
        });
    }
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
            <video controls src={transcoded} autoplay/>
        {/if}

    </div>
</main>
<style>
    p {
        border: 3px solid sandybrown;
        border-radius: 3em;
        padding: 1em;
    }
</style>