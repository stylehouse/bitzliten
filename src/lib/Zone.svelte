<script lang="ts" module>
    import { FFgemp } from "./FFgemp"
    import type { quadjustable, amode, amodes, adublet } from "./FFgemp"
    import Knob from "./Knob.svelte";
    // with <audio> is awkward. maybe somewhere?
    import Player from "./Player.svelte";
    // using the audio api
    import Schaud from "./Schaud.svelte";
    // 2s chunks
    // lots of them together, buffering
    // < loop end adjustment
    //  < with visual...

    let FF = new FFgemp()
    FF.console_log = false
    let message = $state('');
    FF.on('message',(s:string) => message = s)

    // the config
    // < many more configs, mutextualisations.
    let modes:undefined|amodes = $state()

    // the input
    let file = $state()
    // $effect blocks are not async, see https://github.com/sveltejs/svelte/issues/9520#issuecomment-1817092724
    //  basically $.get() won't establish a dependency
    //   for anything async to the call to this $effect()
    //    which is everything before the first await? (ie nothing)
    //  async $.set() does work, on modes|file, because it doesn't matter where it's coming from?
    //   then how do feedback loops stop?
    // once on init we wait for ffmpeg to load then load a file
    $effect(async () => {
        await FF.init()
        modes = FF.modes
        if ('auto') {
            file = 'aliomar.mp3'
            // letsgo()
        }
    });


    // these reset per file:

    // the selection
    let sel = $state({})
    // push|pull their modes/seek|length representation
    let sel_dominant = true

    // size in seconds to encode at a time (a dublet)
    let chunk_length = 2
    // chunks, any time, any modes
    let dublets:Array<adublet> = $state([])
    // chunks to look up and play (~~ playlist)
    //  decided in letsgo()
    let playlets:Array<adublet> = $state([])
    
    // reset per file
    let last_file
    $effect(() => {
        if (file && file != last_file) {
            sel = {in:10,out:20}
            sel_dominant = true
            dublets = []
            playlets = []
            last_file = file
        }
    })
    // ~sel -> modes
    $effect(() => {
        console.log("~sel ",sel)
    })


    // sel <-> modes
    // called from letsgo(), so we have modes[]
    function update_sel() {
        if (sel_dominant) {
            // push to modes, during the 
            sel_to_modes()
            sel_dominant = false
        }
        else {
            // user changes to modes should become sel, which shapes playlets
            modes_to_sel()
        }
    }
    function sel_to_modes() {
        console.log("sel_to_modes()")
        let seek = find_t_in_N(modes,'seek')
        seek.s = sel.in
        let length = find_t_in_N(modes,'length')
        length.s = sel.out - sel.in
    }
    function modes_to_sel() {
        console.log("modes_to_sel()")
        let seek = find_t_in_N(modes,'seek')
        sel.in = seek.s
        let length = find_t_in_N(modes,'length')
        sel.out = seek.s + length.s
    }

    // two paths of config change notification:
    // mutation inside ~modes (via Knob twiddles) or ~file -> processing
    $effect(() => {
        modes && file &&
        // letsgo()
            setTimeout(() => letsgo(),1)
    })
    // mode Knobs call this when adjusted,
    //  their bind:value={m.s} makes modes reactive too
    function config_maybe_changed() {
        letsgo()
    }

    function letsgo() {
        if (sel.in == null) return []
        // update sel
        update_sel()

        // make view of what to play
        update_playlets()
        // find gapos
        let needs = playlets.filter(playlet => !playlet.ideal_dub)
        // let needs = undublets()
        console.log("letsgo() nublets:",needs)
        needs.map(joblet => go_ffmpeg(joblet))
    }
    
    
    // generate a bunch of tiles for your ears to walk on
    function update_playlets() {
        let {n_chunks} = get_timespace(sel)
        // a set of dublets stretching across it
        let nublets = create_unfulfilled_dublets(sel,n_chunks,chunk_length)
        // ready it for being an ffmpeg job
        //  ie include modes+modes_json, which includes its in|out points
        nublets.map(nublet => compile_dublet_modes(nublet))

        // link to candidate dublets
        nublets.map(nublet => find_dub(nublet))

        // and we now call that
        playlets = nublets
    }
    // playlet // dublet
    function find_dub(nublet) {
        // try to match the whole of modes
        let ideal = dublets.filter(dublet => {
            return dublet.modes_json == nublet.modes_json
        })[0]
        if (ideal) {
            nublet.ideal_dub = ideal
        }
        else {
            // settle for any playable instance of that time
            //  for Player to prefer an out-moded bitrate over dead air
            let vague = dublets.filter(dublet => {
                return dublet.in == nublet.in && dublet.out == nublet.out
            })[0]
            if (vague) {
                nublet.vague_dub = vague
            }
        }
    }
    function get_timespace(sel) {
        // we have a notch
        let length = sel.out - sel.in
        if (isNaN(length)) throw "NaN"
        if (length < 0)
            sel.out = sel.in + 4
        // < wind down if sel.out is > file length

        // < blog on this convention
        let n_chunks = Math.ceil(length / chunk_length)
        return {length,n_chunks}
    }
    function compile_dublet_modes(nublet) {
        let clone_modes = () => {
            // < why not?
            // return modes.map(mode => Object.fromEntries(mode))
            return modes.map(mode => {
                let ha = {...mode}
                return ha
            })
        }

        nublet.modes = clone_modes()
        // convert in|out to:
        let seek = find_t_in_N(nublet.modes,'seek')
        seek.s = nublet.in
        let length = find_t_in_N(nublet.modes,'length')
        length.s = nublet.out - nublet.in
        if (length.s <= 0) throw "!length"
        
        // this now describes a unique dublet
        nublet.modes_json = JSON.stringify(nublet.modes)
    }
    function find_t_in_N(N,t) {
        let M = N.filter((m) => m.t == t)
        if (M.length > 1) throw "many t"
        return M[0]
    }
    function create_unfulfilled_dublets(sel,n_chunks,chunk_length:number) :adublet[] {
        return Array(n_chunks).fill(1).map((v,k) => {
            return {
                in: sel.in + k*chunk_length,
                out: sel.in + k*chunk_length + chunk_length,
            }
        })
    }

    let latest_cmd = $state('')
    let pending = false
    async function go_ffmpeg(joblet:adublet) {
        if (pending) return
        pending = true

        latest_cmd = joblet.modes_json
        let result = await FF.transcode(file,joblet.modes)
        joblet.objectURL = URL.createObjectURL(result)
        dublets.push(joblet)

        // back to deciding whether to do anything
        setTimeout(() => letsgo(),0)

        if (message == 'Aborted()') {
            message = 'done'
        }
        pending = false
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
        letsgo()
    }
    function handleDragOver(e) {
        e.preventDefault();
    }
</script>

<main>
    <p>{message}</p>
    <div
        ondrop={handleDrop}
        ondragover={handleDragOver}
        class="drop-zone"
        role="dropzone"
        aria-dropeffect="execute"
        style="border: 2px dashed #ccc; padding: 20px; text-align: center;"
    >
        {#if playlets.length}
            loaded
        {:else}
            <p>
                Drag and drop an audio file here
            </p>
        {/if}
        
    </div>
    <div>
        {#if playlets.length}
            <Schaud {playlets} />
        {:else}
            <p>
                ...
            </p>
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
            <button on:click={letsgo}>AGAIN</button>
            {#if pending}<mode>PENDING</mode>{/if}
        {/if}
    </div>
    {#if latest_cmd.length}
        <p>{latest_cmd}</p>
    {/if}
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
    div {
        text-align: center;
    }
</style>