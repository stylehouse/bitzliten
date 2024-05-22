<script lang="ts" module>
    import { FFgemp,now,dec } from "./ff/FFgemp"
    import type { quadjustable, amode, amodes, adublet } from "./ff/FFgemp"
    import Knob from "./ui/Knob.svelte";
    // with <audio> is awkward. maybe somewhere?
    import Player from "./Player.svelte";
    // per selection
    //  contains Schaud.svelte, using the audio api
    import Selection from "./Selection.svelte";
    import { Fili, Sele,create_unfulfilled_dublets } from "./cuelet_precursor.svelte";
    import File from "./File.svelte";
    // 2s chunks
    // lots of them together, buffering
    // < loop end adjustment
    // with visual...

    let FF = new FFgemp()
    FF.console_log = false
    let message = $state('');
    FF.on('message',(s:string) => message = s)

    // the config
    // < many more configs, mutextualisations.
    let modes:undefined|amodes = $state()

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
            let path = 'loom - Dsharp Minor Triblaalistic 170 Experiment 6 10 20222.flac'
            new_fil({path})
            // letsgo()
        }
    });


    // these reset per file:

    // info about the file
    let files = $state([])
    let files_PK = 0
    let new_fil = (c={}) => {
        let fil = new Fili({id:files_PK++,...c})
        files.push(fil)
        return fil
    }
    // the selection
    let selections = $state([])
    let selection_PK = 0
    let new_sel = (c={}) => {
        // usually are created once a c={fil} is ready (with .data)
        let sel = new Sele({id:selection_PK++,...c})
        selections.push(sel)
        // allow /$sel to be added to in Selection.svelte
        // < better than this - seems a messy hack - but worked for needles/Pointer
        sel.set = (c) => {
            Object.assign(sel,c)
        }
        return sel
    }
    // as Fili avail .data, they create an:
    let fil_onload = (fil) => {
        let sel = new_sel({fil})
    }
    // size in seconds to encode at a time (a dublet)
    //  which sel.in|out are always a multiple of
    let chunk_length = 2
    // chunks, any time, any modes
    let dublets:Array<adublet> = $state([])
    // chunks to look up and play (~~ playlist)
    //  decided in letsgo()
    let playlets:Array<adublet> = $state([])
    
    

    // MediaMetadata
    // < supposing this is for nowplaying info for the browser|platform?
    //   doesn't work for me - a speaker icon appears on the tab
    //    but the browser's two-notes music icon for media control doesn't include it
    //    this might be because of no https?
    // $effect(() => {
    //     let meta = fileinfo?.meta
    //     if (!meta) return

    //     console.log("Pushing  MediaMetadata",fileinfo)

    //     // Create a MediaMetadata object
    //     const mediaMetadata = new MediaMetadata({
    //         title: meta.title??'',
    //         artist: meta.artist??'',
    //         album: meta.album??'',
    //         // < look for a jpeg stream, transcode it out?
    //         // artwork: [
    //         // {
    //         //     src: 'path/to/album-art.jpg',
    //         //     sizes: '512x512',
    //         //     type: 'image/jpeg',
    //         // },
    //         // ],
    //     });
        
    //     // Set the mediaSession metadata
    //     if ('mediaSession' in navigator) {
    //         navigator.mediaSession.metadata = mediaMetadata;
    //     }
    // })



    // two paths of config change notification:
    // mutation inside ~modes (via Knob twiddles) or ~file -> processing
    $effect(() => {
        selections && modes &&
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
        console.log("on_reselection()")
            setTimeout(() => letsgo(),1)
    }

    function letsgo() {
        if (selections[0] == null) return
        playlets = []
        // < support more than one?
        selections.map(sel => {
            if (sel.in == null) return
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
    function make_playlets(sel:Sele):adublet[] {
        // how to encode (modes)
        sel.modes = clone_modes()
        // and attaches the Fili's identity
        if (!sel.fil.dig) debugger
        set_modes_value(sel.modes,'input',sel.fil.name+"#"+sel.fil.dig)

        let {n_chunks} = get_timespace(sel)
        // a set of dublets stretching across it
        let nublets = create_unfulfilled_dublets(sel,n_chunks,chunk_length)
        // ready it for being an ffmpeg job
        //  ie include modes+modes_json, which includes its in|out points
        nublets.map(nublet => {
            // copy how to do things
            nublet.modes = clone_modes(sel.modes)
            // narrow in|out to this nublet
            sel_to_modes(nublet,nublet.modes)
            // this now describes a unique dublet
            nublet.modes_json = JSON.stringify(nublet.modes)
        })
        nublets.map(nublet => {
            console.log(`nublet ${nublet.in}: ${sel.fil.name}`)
        })
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
                    && dublet.sel.fil == nublet.sel.fil
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
    function clone_modes(these) {
        these ||= modes
        // < why not?
        // return modes.map(mode => Object.fromEntries(mode))
        return these.map(mode => {
            let ha = {...mode}
            return ha
        })
    }
    // sel -> modes
    // called from letsgo(), so we have modes[]
    type sel_basically = {in,out}
    function sel_to_modes(sel:sel_basically,modes) {
        set_modes_value(modes,'seek',sel.in)
        let length = sel.out - sel.in
        if (length <= 0) throw "!length"
        set_modes_value(modes,'length',length)
    }
    function set_modes_value(modes,t,s) {
        if (s == null) throw "huh"
        let mode = find_t_in_N(modes,t)
        mode.s = s
    }
    function find_t_in_N(N,t) {
        let M = N.filter((m) => m.t == t)
        if (M.length > 1) throw "many t"
        return M[0]
    }

    let latest_cmd = $state('')
    let fileinfo = {}
    let pending = false
    let last_job_time = null
    async function go_ffmpeg(joblet:adublet) {
        if (pending) return
        pending = true

        // this Uint8Array gets consumed for some reason
        // < sync files over there, which could be ffmpeg via REST
        let file = joblet.sel.fil.data.slice()
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
        let given = e.dataTransfer.files
        if (given.length > 1) {
            throw "< sets of pictures"
        }
        // < multi-track sanity
        selections = []
        files = []
        for (let file of given) {
            new_fil({file})
        }
    }
    function handleDragOver(e) {
        e.preventDefault();
    }
    let reboot = $state(0)
    function rebootup(e) {
        reboot++
    }
</script>

<main>
    {#key reboot}
    <p>{message} <button onclick={rebootup}>reboot</button></p>
    <!-- svelte-ignore a11y_unknown_role -->
    <div
        ondrop={handleDrop}
        ondragover={handleDragOver}
        class="drop-zone"
        role="dropzone"
        aria-dropeffect="execute"
        style="border: 2px dashed #ccc; padding: 20px; text-align: center;"
    >
        {#each files as fil (fil.id)}
            <File {fil} onload={() => fil_onload(fil)} />
        {/each}

        {#if playlets.length}
            <!-- loaded: {JSON.stringify(fileinfo)} -->
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
            <button onclick={letsgo}>AGAIN</button>
        {/if}
    </div>
    {#if latest_cmd.length}
        <p>{latest_cmd}</p>
    {/if}
    {/key}
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