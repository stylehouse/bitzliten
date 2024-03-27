<script lang="ts" module>
    import { FFmpeg } from "@ffmpeg/ffmpeg";
    // @ts-ignore
    // import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
    import { fetchFile } from "@ffmpeg/util";
    import { onMount } from "svelte";

    let message;
    let transcoded;
	let source_video: HTMLVideoElement;

    let ffmpeg;
    const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";
    async function loadFFmpeg() {
        ffmpeg = new FFmpeg();
        message = "Loading ffmpeg-core.js";
        try {
            ffmpeg.on("log", ({ message: msg }) => {
                message = msg;
                console.log(message);
            });

            let parts = {
                coreURL: await toBlobURL(
                    `${baseURL}/ffmpeg-core.js`,
                    "text/javascript",
                ),
                wasmURL: await toBlobURL(
                    `${baseURL}/ffmpeg-core.wasm`,
                    "application/wasm",
                ),
                workerURL: await toBlobURL(
                    `${baseURL}/ffmpeg-core.worker.js`,
                    "text/javascript",
                ),
            };

            message = "Init ffmpeg-core.js";
            await ffmpeg.load(parts);
            message = "Ready";
        } catch (err) {
            message = "Error: " + err;
            console.error(err);
        }
    }
    async function toBlobURL(url, mimeType) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }
            const blob = await response.arrayBuffer();
            return URL.createObjectURL(new Blob([blob], { type: mimeType }));
        } catch (err) {
            console.error(`Error loading ${url}: ${err.message}`);
            throw err;
        }
    }
    onMount(() => loadFFmpeg());

    async function transcode(file) {
        const data = await fetchFile(file);
		source_video.src = URL.createObjectURL(file);
        self.ffmpeg = ffmpeg
        let ext = 'mkv'
        let output = 'output.'+ext
        let input = 'input.avi'; // or file.name
        await ffmpeg.writeFile(input, data);
        await ffmpeg.exec([
            "-i",
            input,

            "-b:a","40k",
			"-strict","-2", "-c:a","opus",
			// "-c:v","copy", // lossless video
            "-vn", // no video stream
            // "-c:v","mjpeg", // except for album art (requires .mkv)
            output,
        ]);
        transcoded = ffmpeg.readFile(output);
        return new Blob([transcoded.buffer], { type: "audio/"+ext });
    }

    let file
    function handleDrop(e) {
        e.preventDefault();
        let audioFile = file = e.dataTransfer.files[0];
        transcode(audioFile).then((result) => {
            transcoded = URL.createObjectURL(result);
        });
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
            <video controls src={transcoded} />
        {/if}


        {#if file}
            <p> Original
                <video bind:this={source_video} controls />
            </p>
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