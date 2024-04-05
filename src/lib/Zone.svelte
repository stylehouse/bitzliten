<script lang="ts" module>
    import { FFgemp } from "./FFgemp"
    import Knob from "./Knob.svelte";
    import Player from "./Player.svelte";
    // < 2s chunks
    // < lots of them together, buffering
    // < loop end adjustment
    //  < with visual...

    let FF = new FFgemp()
    FF.console_log = false
    let message = $state('');
    FF.on('message',(s) => message = s)

    // the config
    // < many more configs, mutextualisations.
    type quadjustable = any
    type amode = {
        t:string,
        // the value
        s?:quadjustable,
        // if value is adjustable
        min?:number, max?:number,
        // returns ffmpeg command options, is given s
        cmd?:(s: quadjustable) => string[],
    }
    type amodes = Array<amode>
    let modes:undefined|amodes = $state()

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

    // these reset per file:
    // the selection
    let sel = $state({})
    // how-encoded chunks
    type adublet = {in:number,out:number, modes?:amodes, objectURL?:any}
    let dublets = $state([])
    // reset per file
    $effect(() => {
        if (file) {
            sel = {in:10,out:20}
            dublets = []
        }
    })
    // ~modes (via Knob twiddles) ~file -> processing
    $effect(() => {
        modes && file && letsgo()
    })
    // mode Knobs call this when adjusted,
    //  their bind:value={m.s} makes modes reactive too
    function config_maybe_changed() {
        letsgo()
    }


    let transcoded:any = $state()

    function letsgo() {
        if (sel.in == null) return []
        let needs = undublets()
        console.log("letsgo() nublets:",needs)
        needs.map(joblet => go_ffmpeg(joblet))
    }
    
    // generate a bunch of tiles for your ears to walk on
    // size in seconds to encode at a time
    let chunk_length = 2
    function undublets() {
        let selout = sel.out
        // we have a notch
        let length = sel.out - sel.in
        if (isNaN(length)) throw "NaN"
        if (length < 0)
            sel.out = sel.in + 4
        // < wind down if sel.out is > file length

        let chunks = Math.ceil(length / chunk_length)

        // a set of dublets stretching across it
        let nublets = create_unfulfilled_dublets(sel,chunks,chunk_length)

        // ready it for being an ffmpeg job
        //  ie include modes, which includes its in|out points
        compile_dublet_modes(nublets)

        // to compare with what we have cached
        let unhad = nublets.filter(nublet => {
            return !have_a_dublet_for(nublet)
        })
        return unhad
    }
    function have_a_dublet_for(nublet:adublet) {
        return dublets.some(dublet => {
            return dublet.modes_json == nublet.modes_json
        })
    }
    function compile_dublet_modes(nublets) {
        let clone_modes = () => {
            // < why not?
            // return modes.map(mode => Object.fromEntries(mode))
            return modes.map(mode => {
                let ha = {...mode}
                return ha
            })
        }
        nublets.map(nublet => {
            nublet.modes = clone_modes()
            // convert in|out to:
            let seek = find_t_in_N(nublet.modes,'seek')
            seek.s = nublet.in
            let length = find_t_in_N(nublet.modes,'length')
            length.s = nublet.out - nublet.in
            if (length.s <= 0) throw "!length"
            
            // this now describes a unique dublet
            nublet.modes_json = JSON.stringify(nublet.modes)
        })
    }
    function find_t_in_N(N,t) {
        let M = N.filter((m) => m.t == t)
        if (M.length > 1) throw "many t"
        return M[0]
    }
    function create_unfulfilled_dublets(sel,chunks,chunk_length:number) :adublet[] {
        return Array(chunks).fill(1).map((v,k) => {
            return {
                in: sel.in + k*chunk_length,
                out: sel.in + k*chunk_length + chunk_length,
            }
        })
    }

    let pending = 0
    let last_config = ''
    async function go_ffmpeg(joblet:adublet) {
        if (pending) {
            // < stop it
            // tell current job to start again when done
            //  < could be the default to check for more nublets
            pending = 2
            return
        }
        pending = 1

        let result = await FF.transcode(file,joblet.modes)
        joblet.objectURL = URL.createObjectURL(result)

        dublets.push(joblet)

        if (pending == 2) {
            // we tried to start a job while working on this one
            //  so start thinking again
            setTimeout(() => letsgo(),1)
        }
        if (message == 'Aborted()') {
            message = 'done'
        }
        pending = 0
        last_config = joblet.modes_json
    }
    


    let playerel = $state()
    $effect(async () => {
        if (!playerel) return
        try { await playerel.play() }
        catch (er) {
            if (er.name == "NotAllowedError") return
            throw er
        }
    })

    

    

    function handleDrop(e) {
        e.preventDefault();
        file = e.dataTransfer.files[0];
        debugger
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
            <audio src={transcoded}
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
    div.drop-zone {
        padding: 3em
    }
</style>