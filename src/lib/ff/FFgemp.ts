import { FFmpeg } from "@ffmpeg/ffmpeg";
import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
import { fetchFile, toBlobURL } from './not-ffmpeg-util';

export let now = () => new Date().getTime() / 1000
// round number
export function dec(s,places=4) {
    s = s*1
    if (isNaN(s)) throw "ohno"
    return s.toFixed(places) * 1
}
export async function fetch(url) {
    return await fetchFile(url)
}
export async function getSHA256HashOfUint8Array(uint8Array) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', uint8Array);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
// A small UI library to do:
// - wasm init asap or when jobbed
// - job config schema (what is adjustable) and scrapheap (culture)
// - returning that typed blob (knowing job)
// But not do:
// - drag and drop (is different per framework)
// - <video>

// types
    type quadjustable = any;

    type amode = {
        t: string; // the value
        s?: quadjustable; // if value is adjustable
        min?: number;
        max?: number; // returns ffmpeg command options, is given s
        cmd?: (s: quadjustable) => string[];
    };

    type amodes = Array<amode>;

    type adublet = {
        in: number;
        out: number;
        modes?: amodes;
        objectURL?: any;
    };
    type acuelet = adublet & {intime:number,outtime:number,objectURL:string,playlet:adublet}

    export type { quadjustable, amode, amodes, adublet,acuelet };

// inform ui of how to play with things
function modes() {
    return [
        // these are m
        {
            t: "input", to: "i", s: '000',
            cmd: (s) => [],
        },
        {
            t: "seek", to: "ss", min: 1, max: 444, s: 30,
            cmd: (s) => ["-ss", s],
        },
        {
            t: "length", to: "t", min: 1, max: 128, s: 10,
            cmd: (s) => ["-t", s],
        },

        {
            t: "lowbitrate", to: "b:a", min: 6, max: 128, s: 40,
            cmd: (s) => ["-b:a", s + "k"],
        },
        {
            t: "opus", to: "c:a",
            cmd: () => ["-strict", "-2", "-c:a", "opus"],
        },
    ]
}

export class FFgemp {
    public console_log: boolean = true;
    private loaded: boolean = false;
    private ffmpeg: any;
    private on_handlers: any = {};

    constructor() {
        // these can be edited in place
        this.modes = modes()
    }
    modes_to_cmds(modes) {
        modes ||= this.modes
        // the pile of modes may be a huge knowledge base
        // dedupe what they apply to
        let firstto = {}
        let cmds = []
        modes.map(m => {
            if (firstto[m.t]) return
            firstto[m.t] = m

            let val = m.s
            if (m.cmd) {
                let re = m.cmd(val)
                this.console_log && console.log("+ mode "+m.t+": "+(re.join(" ")))
                cmds.push(...re)
            }
        })
        return cmds.map(s => ''+s)
    }

    // log messages
    private m(message: string) {
        this.on_handle('stdout', message)
        this.on_handle('message', message)
        this.console_log && console.log(message);
    }
    on_handle(name: string, s: any) {
        let callback = this.on_handlers[name]
        callback && callback(s)
    }
    on(name: string, callback: Function) {
        this.on_handlers[name] = callback
    }
    off(name: string) {
        delete this.on_handlers[name]
    }

    async init() {
        // warn about problems that may occur
		if (!crossOriginIsolated) {
			console.warn("crossOriginIsolated is false: configure Cross-Origin-(Opener|Embedder)-Policy")
		}
		if (typeof SharedArrayBuffer == 'undefined') {
			console.warn("SharedArrayBuffer is false: is crossOriginIsolated false?")
		}
        
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


    async transcode(file: File,modes,fileinfo) {
        const data = file
        // await fetchFile(file);
        const input = 'input.mp3';
        const ext = 'mkv';
        const output = 'output.' + ext;
        // < not every time: have a filemanager in Zone, check hashes
        await this.ffmpeg.writeFile(input, data);
        let done = this.read_ffmpeg_stdout_into(fileinfo)
        await this.ffmpeg.exec([
            "-i", input,
            ...this.modes_to_cmds(modes),
            // "-c:v","copy", // lossless video
            "-vn", // no video stream
            // "-c:v","mjpeg", // except for album art (requires .mkv)
            output,
        ]);
        done()

        const out = await this.ffmpeg.readFile(output);
        return new Blob([out.buffer], { type: "audio/" + ext });
    }

    // < separate this to a `ffmpeg -i $file` job for identifying what the user gives us
    read_ffmpeg_stdout_into(fileinfo) {
        let inside = {}
        let interpret = (m:string) => {
            if (m.startsWith('Input #')) return inside.input = 1
            if (!m.startsWith('  ')) inside.input = 0
            if (inside.input) {
                if (m.startsWith('  Metadata')) return inside.metadata = 1
                if (!m.startsWith('    ')) inside.metadata = 0
                if (inside.metadata) {
                    let match = m.match(/^    (\w+)\s*: (.+)\n?$/);
                    if (match) {
                        let meta = fileinfo.meta ||= {}
                        meta[match[1]] = match[2]
                    }
                }
                else {
                    let match = m.match(/  Duration:\s*(\d+):(\d+):(\d+\.\d+).+?bitrate: (\d.+)$/)
                    if (match) {
                        let [whole,hours,minutes,seconds,bitrate] = match
                        seconds = seconds*1 + minutes*60 + hours*60*60
                        fileinfo.duration = seconds
                        fileinfo.bitrate = bitrate
                    }
                    match = m.match(/  (Stream #\S+): (.+)$/)
                    if (match) {
                        let streams = fileinfo.streams ||= {}
                        streams[match[1]] = match[2]
                    }
                }
            }
            // < check jpeg data on the input did|didn't get into the transcoded-music|dublets
            //   sometimes there are weird noises attached to songs, sometimes biographies etc
            if (m.startsWith('Output #')) return
        }
        this.on('stdout', interpret)
        return () => {
            this.off('stdout')
        }
    }

}


function things() {
    return 1
}

