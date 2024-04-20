<script lang="ts" module>
    import { FFgemp,now,dec } from "./FFgemp"
    import type { quadjustable, amode, amodes, adublet } from "./FFgemp"
    import Knob from "./Knob.svelte";
    // with <audio> is awkward. maybe somewhere?
    import Player from "./Player.svelte";
    // per selection
    //  contains Schaud.svelte, using the audio api
    import Selection from "./Selection.svelte";
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
            // file ||= 'aliomar.mp3'
            file ||= 'loom - Dsharp Minor Triblaalistic 170 Experiment 6 10 20222.flac'
            // letsgo()
        }
    });


    // these reset per file:

    // info about the file
    let fileinfo = $state()
    // the selection
    let selections = $state([])
    // size in seconds to encode at a time (a dublet)
    //  which sel.in|out are always a multiple of
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
            fileinfo = {}
            init_sel()
            dublets = []
            playlets = []
            last_file = file
        }
    })
    function init_sel() {
        selections = [
            {id:0}
        ]
        // allow /$sel to be added to in Selection.svelte
        // < better than this - seems a messy hack - but worked for needles/Pointer
        selections.map(sel => {
            sel.set = (c) => {
                Object.assign(sel,c)
            }
        })
        // in:40,out:46
        // // copies to modes after this
        // sel_dominant = true
        // // knows how to apply changes
        // sel.input = (o) => sel_input(o)
        // // input itself to create the fine-grained layer start|end
        // sel_input(sel)
    }
    

    // these in|out or start|end come from yonder
    async function sel_input(o) {
        let was = {in:sel.in,out:sel.out}
        // make a fine-grained layer
        let fel = {}
        fel.start = o.in
        fel.end = o.out
        // inclusively select dublet spaces
        fel.in = Math.floor(fel.start / chunk_length) * chunk_length
        fel.out = Math.ceil(fel.end / chunk_length) * chunk_length

        Object.assign(sel,fel)
        if (was.in != fel.in || was.out != fel.out) {
            sel_to_modes()
            letsgo()
        }
        return console.log(`resists sel input`,o)
    }

    // let le
    // ~sel -> modes
    // $effect(() => {
    //     let see = sel.in
    //     // < this must be done, or the log() never happens, wtf
    //     le = see
    //     console.log("~sel ",sel)
    // })


    // sel -> modes
    // called from letsgo(), so we have modes[]
    function sel_to_modes(sel) {
        // console.log("sel_to_modes()")
        let seek = find_t_in_N(modes,'seek')
        seek.s = sel.in
        let length = find_t_in_N(modes,'length')
        length.s = sel.out - sel.in
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
    // Knobs elsewhere, eg Selection
    function on_reselection() {
        letsgo()
    }

    function letsgo() {
        if (selections[0] == null) debugger
        playlets = []
        // < support more than one?
        selections.map(sel => {
            if (sel.in == null) return
            // copy this sel to modes
            sel_to_modes(sel)

            // make view of what to play
            sel.playlets = make_playlets(sel)
            playlets.push(...sel.playlets)
        })
        // find gapos
        let needs = playlets.filter(playlet => !playlet.ideal_dub)
        prioritise_needs(needs)
        console.log("letsgo() nublets:",needs)
        needs[0] && go_ffmpeg(needs[0])
    }
    
    
    // generate a bunch of tiles for your ears to walk on
    function make_playlets(sel) {
        let {n_chunks} = get_timespace(sel)
        // a set of dublets stretching across it
        let nublets = create_unfulfilled_dublets(sel,n_chunks,chunk_length)
        // ready it for being an ffmpeg job
        //  ie include modes+modes_json, which includes its in|out points
        nublets.map(nublet => compile_dublet_modes(nublet))

        // link to candidate dublets
        nublets.map(nublet => find_dub(nublet))

        // and we now call that
        return nublets
    }
    // playlet // dublet
    function find_dub(nublet) {
        // try to match the whole of modes
        let ideal = dublets.find(
            dublet => dublet.modes_json == nublet.modes_json
        )
        if (ideal) {
            nublet.ideal_dub = ideal
        }
        else {
            // settle for any playable instance of that time
            //  for Player to prefer an out-moded bitrate over dead air
            let vague = dublets.find(
                dublet => dublet.in == nublet.in && dublet.out == nublet.out
            )
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
    let last_job_time = null
    async function go_ffmpeg(joblet:adublet) {
        if (pending) return
        pending = true

        latest_cmd = joblet.modes_json
        let job_start_ts = now()
        let result = await FF.transcode(
            file,
            joblet.modes,
            fileinfo
        )
        joblet.objectURL = URL.createObjectURL(result)
        dublets.push(joblet)
        last_job_time = now() - job_start_ts

        // back to deciding whether to do anything
        setTimeout(() => letsgo(),0)

        if (message == 'Aborted()') {
            message = 'done in '+dec(last_job_time,3)+'s'
        }
        fileinfo = fileinfo
        pending = false
    }
    let duration = $state()
    $effect(() => {
        if (fileinfo?.duration) duration = fileinfo.duration
    })
    
    // < detect and diag about not being allowed to .play() sound

    // talk to cuelet playing now
    let needle_uplink = {}
    // rearrange joblist so the first is soonest played
    function prioritise_needs(needs) {
        if (!needs[0] || !needle_uplink.stat) return
        let {cuenow,remains} = needle_uplink.stat()
        if (!cuenow) return
        
        // wind needs around to where we are
        let many = needs.length
        while (needs[0].out < cuenow.out) {
            if (many-- < 0) break
            needs.push(needs.shift())
        }
        // and maybe just hop to the next one if soon
        if (remains < last_job_time+0.2) {
            needs.push(needs.shift())
        }
    }
    // also, cuelet player can reject bad records:
    //  for some reason some of these objectURLs return blobs only 800 long
    let needle_complaints = 0
    needle_uplink.bad_playlet = (playlet) => {
        let dublet = playlet.ideal_dub || playlet.vague_dub
        dublets = dublets.filter(dub => dub != dublet)
        if (!needle_complaints) {
            needle_complaints = 1
            setTimeout(() => {
                if (needle_complaints > 1) letsgo()
                needle_complaints = 0
            }, 1300)
            setTimeout(() => letsgo(), 660)
        }
        else {
            needle_complaints++
        }
    }

    

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
            loaded: {JSON.stringify(fileinfo)}
        {:else}
            <p>
                Drag and drop an audio file here
            </p>
        {/if}
        
    </div>
    <div>
        {#each selections as sel (sel.id)}
            <Selection {sel} {needle_uplink}
                {on_reselection} {chunk_length} {duration} />
        {/each}
        

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