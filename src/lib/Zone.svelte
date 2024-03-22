<script lang="ts" module>
    import { FFmpeg } from "@ffmpeg/ffmpeg";
    // @ts-ignore
    // import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
    import { fetchFile } from "@ffmpeg/util";
    import { onMount } from "svelte";

    let message;
    let transcoded;

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
        self.ffmpeg = ffmpeg
        ffmpeg.writeFile(file.name, data);
        await ffmpeg.exec([
            "-i",
            file.name,
            "-b:a",
            "40k",
            "output.opus",
        ]);
        transcoded = ffmpeg.readFile("output.opus");
        return new Blob([transcoded.buffer], { type: "audio/opus" });
    }

    function handleDrop(e) {
        e.preventDefault();
        let audioFile = e.dataTransfer.files[0];
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
            <audio controls src={transcoded} />
        {/if}
    </div>
</main>
