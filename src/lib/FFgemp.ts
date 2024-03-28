import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
import { fetchFile, toBlobURL } from '$lib/not-ffmpeg-util';

export class FFgemp {
    private loaded: boolean = false;
    private ffmpeg: any;
    private on_handlers: any = {};

    constructor() {
    }

    // log messages
    private m(message: string) {
        this.on_handle('message',message)
        console.log(message);
    }
    on_handle(name:string,s:any) {
        let callback = this.on_handlers[name]
        callback && callback(s)
    }
    on(name:string,callback:Function) {
        this.on_handlers[name] = callback
    }

    async init() {
        this.ffmpeg = new FFmpeg();
        this.m("Loading ffmpeg.wasm");
        let baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";

        try {
            this.ffmpeg.on("log", ({ message: msg }: { message: string }) => {
                this.m(msg);
            });

            const parts = {
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
                workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
            };

            this.m("Init ffmpeg.wasm");
            await this.ffmpeg.load(parts);
            this.m("Ready");
            this.loaded = true
        } catch (err) {
            this.m("LoadError: " + err);
        }
    }

    async transcode(file: File) {
        
        const data = await fetchFile(file);
        const input = 'input.avi';
        const ext = 'mkv';
        const output = 'output.' + ext;
    
        await this.ffmpeg.writeFile(input, data);
        await this.ffmpeg.exec([
          "-i", input,
          "-t", "10",
          "-b:a", "40k",
          "-strict", "-2",
          "-c:a", "opus",
          // "-c:v","copy", // lossless video
          "-vn", // no video stream
          // "-c:v","mjpeg", // except for album art (requires .mkv)
          output,
        ]);
    
        const out = await this.ffmpeg.readFile(output);
        return new Blob([out.buffer], { type: "audio/" + ext });
      }
}