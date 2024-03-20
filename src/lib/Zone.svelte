<script lang=ts module>
    // import {ffmpeg as fuf} from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';

    import { FFmpeg } from '@ffmpeg/ffmpeg';
	// @ts-ignore
	// import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
	import { fetchFile, toBlobURL } from '@ffmpeg/util';
    import { onMount } from 'svelte';

	let message:string
    let transcoded

    // async function loadFFmpeg() {
	// 	message = 'Loading ffmpeg';
    //     ffmpegInstance = await ffmpeg.createFFmpeg();
    //     isFFmpegLoaded = true;
	// 	message = 'Drop Audio Here'
    // }

    // loadFFmpeg();

    let ffmpeg
	const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';
	async function loadFFmpeg() {
        ffmpeg = new FFmpeg();
		message = 'Loading ffmpeg-core.js';
		ffmpeg.on('log', ({ message: msg }) => {
			message = msg;
			console.log(message);
		});
		await ffmpeg.load({
			coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
			wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
			workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript')
		});
		message = 'Drop Audio Here'
	}
    onMount(() => loadFFmpeg())

    async function transcode(file) {
        const data = await fetchFile(file);
        ffmpeg.FS("writeFile", file.name, data);
        await ffmpeg.run(
            "-i",
            file.name,
            "-b:a",
            "40k",
            "output.opus",
        );
        transcoded = ffmpeg.FS("readFile", "output.opus");
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
