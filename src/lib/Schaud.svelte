<script lang="ts">
    import { tweened } from 'svelte/motion';
	import { fade,scale } from 'svelte/transition';
    import { dec } from "./ff/FFgemp"
    import { Cueleter, ModusCueletSeq, ModusOriginale } from "./cuelets.svelte"
    import type { quadjustable, amode, amodes, adublet,acuelet } from "./ff/FFgemp"
    import Pointer from './ui/Pointer.svelte';
    import { onDestroy, untrack } from 'svelte';
    import { Sele } from './cuelet_precursor.svelte';

    let {
        needle_uplink,
        sel,
        // snippets
        leftend,rightend,
    } = $props()
    let ready = $state(0)
    // figures approach,
    let cuelets = $state([])
    let orch:Cueleter
    let audioContext:AudioContext
    $effect(() => {
        orch = new Cueleter({cuelets,sel,needle_uplink})
        audioContext = orch.audioContext
    })
    onDestroy(() => {
        audioContext.close()
    })

    // playlets -> cuelets
    $effect(() => {
        orch.sync_cuelets(sel.playlets)
    })

    let modus = $state([])
    // our default thing to do
    modus[0] = new ModusCueletSeq()
    // respond to editing
    let ori = modus[1] = new ModusOriginale()
    $effect(() => {
        sel?.in != null && ready && ori.edge_moved({which:'in'})
    })
    $effect(() => {
        sel?.out != null && ready && ori.edge_moved({which:'out'})
    })
    
    
    function newSpasm() {
        let con = orch.spasm_control = {}
        orch.spasm({modus,con})
    }
    onDestroy(() => orch.spasm_control = {})



// our loop
    $effect(() => {
        if (cuelets[0]?.buffer) ready = 1
    })
    $effect(() => {
        if (ready) newSpasm()
    })
    function thump_machinery() {
        ready = ready + 1
        modus.map(mo => {
            delete mo.cuenow
        })
        newSpasm()
    }

    let fadetime = 1.5
    let upto = $state(0)
    type acuelet = adublet & {startTime:number,source,needle,el}
    function oscil() {
        const oscillator = audioContext.createOscillator();
        // Set the oscillator type to sine wave
        oscillator.type = 'sine';
        // Set the frequency to 60Hz
        oscillator.frequency.value = 260;
        return oscillator
    }

    let displaytime = $state(0)
    // $effect(() => {
    //     up_displaytime()
    // })
    
    let theone = {}
    let audio_state = ''
    let up_displaytime =
    needle_uplink.up_displaytime = (the) => {
        if (the && the != theone) return
        the = theone = {}
        setTimeout(() => up_displaytime(the), 166)

        if (!needle_uplink.stat) return
        let {cuenow,cue_time,loop_time} = needle_uplink.stat()
        if (!(cuenow && cuenow.el)) return
        
        displaytime = dec(loop_time)
        check_time_is_passing(cue_time)
        if (audioContext.state == 'running') needle_moves()
    }

    // tween takes on the duration of the cuelet when .set()
    let needles = $state([
        {id: 0,mirror:1},
        {id: 1},
    ])
    needles.map(ne => {
        ne.set_tweens = (c) => {
            Object.assign(ne,c)
        }
    })
    // pick the same needle for continuous sets of cuelets
    let whichneedle = 0
    // < GOING this var... delete with scheduleNextSound()
    let find_unused_needle =
    needle_uplink.find_unused_needle = () => {
        // there are only two
        // < it seems we can't compare needle==needle, because they are different proxy objects?
        let used = cuelets.map(cuelet => cuelet.needle?.id)
        let is_used = (ne) => used.includes(ne.id)
        let ne = needles[whichneedle]
        if (is_used(ne)) whichneedle = whichneedle == 0 ? 1 : 0
        ne = needles[whichneedle]
        if (!ne) debugger
        return ne
    }

    let has_tween:null|acuelet = null
    function needle_moves() {
        let {cuenow,cue_time,time_of,remains,loop_time,zip} = needle_uplink.stat()
        // occasionally generate bad data from ffmpeg, eg if seek > file length
        // if (!zip.source.buffer) return
        // do the rest once per cuenow
        if (has_tween == cuenow) return
        has_tween = cuenow
        // 1-2 needles exist
        let needle = cuenow.needle
        // if (!needle) return
        if (!needle) throw '!needle'

        // we come here right after sound.start()
        if (time_of > 0.05) console.warn("long time to needle_moves: "+time_of)

        let cueletswidth = cuenow.el.offsetWidth
        let progress = cue_time              / zip.whole_duration
        let completed = (cue_time + remains) / zip.whole_duration
        let some_left = progress * cueletswidth
        // fade in quickly, politely appear
        //  clobbered by a longer one for crossfades
        needle.opacity.set(1,{duration:0.1*1000})
        needle.left.set(cuenow.el.offsetLeft*1 + progress * cueletswidth)
        needle.left.set(cuenow.el.offsetLeft*1 + completed * cueletswidth*1,{duration:remains*1000})
        needle.top.set(cuenow.el.offsetTop)

        console.log(`needle_moves: @ ${cue_time} \t${progress}\t remains: ${dec(remains)}\t`)
        // here we can keep the needle at 0 to align new sprites
        //  ie where in the image of the pointer (hand) the point (fingertip) is
        // needle.left.set(0)
    }


    let last_cuetime = null
    let seem_not_to_play = 0
    let it_seems_not_to_play = $state(false)
    function check_time_is_passing(cue_time) {
        if (cue_time != last_cuetime) {
            seem_not_to_play = 0
            it_seems_not_to_play = false
        }
        else {
            seem_not_to_play += 1
            if (seem_not_to_play > 2) {
                it_seems_not_to_play = true
            }
        }
        last_cuetime = cue_time
    }
    function cuelet_class(cuelet) {
        return cuelet.buffer ? '' : 'unbuffered'
    }
    function cuelet_info(cuelet) {
        let msg = []
        // 
        msg.push(cuelet.in+'-'+cuelet.out)
        // .buffer is decoded audio, .source while playing it
        if (!cuelet.buffer) {
            msg.push("!buffer")
        }
        else if (cuelet.buffer.length < 2000) {
            // very small buffer is likely bad data
            // occasionally generate bad data from ffmpeg, eg if seek > file length
            msg.push(`buffer(${cuelet.buffer.length})`)
        }
        else {
            let Bps = cuelet.blob_size / cuelet.buffer.duration
            let kbps = dec(Bps*8 / 1000,2)
            // this isn't so accurate I think
            //  and complicates the UI
            // < getting ffmpeg to read the output file and tell us
            //    involves parsing its output which I've done in python
            // msg.push(`${kbps}k`)
        }
        return msg.join(" - ")
    }
    // pixels of width per second
    // < scalable?
    let width_per_s = 100
    // where the ends of the cuelets are
    //  for positioning things in time from there
    let ends = $state([])
    $effect(() => {
        let cuein = cuelets[0]
        let cueout = cuelets.slice(-1)[0]
        if (!cuein || !cueout) throw "!cue ends"
        ends[0] = cuein.in
        ends[1] = cueout.out
    })
</script>

<div>*audio* {upto}:
     <!-- {displaytime} -->
     {audio_state}
    </div>
<div>
    <span>
        <span>
            <button onclick={thump_machinery}>thump</button>
            {@render leftend(ends[0],width_per_s)}
        </span>
{#key ready}
        {#each cuelets as cuelet (cuelet.in)}
        <!-- transition:scale -->
            <soundbox 
                class={cuelet_class(cuelet)}
                bind:this={cuelet.el}
                >
                {#if cuelet.moodbar}
                    <moodbar class="liner"
                        style="background-image:{`url(${cuelet.moodbar})`}"
                        />
                    <moodbar class="liner mask"/>
                {/if}
                
                <span>&nbsp; {cuelet_info(cuelet)}</span>
            </soundbox>
        {/each}
{/key}
        <span>
            {@render rightend(ends[1],width_per_s)}

        </span>
        <div> 
            IN|OUT:{sel.in}|{sel.out}
        </div>
        
    <!-- 
             -->
    
    {#each needles as ne (ne.id)}
        <Pointer {ne}  />
    {/each}

    {#if it_seems_not_to_play}
        <bigdiv transition:scale onclick={thump_machinery}>
            <h1>click here</h1> audio playback requires interaction
        </bigdiv>
    {/if}

    </span>

</div>

    <style>
        bigdiv {
            position:fixed;
            opacity:0.7;
            background-color:bisque;
            border-radius: 1em;
            width: 40%;
            height: 40%;
            left: 30%;
            top: 30%;
            color: red;
        }
        div span {
            position:relative;
        }
        soundbox {
            width: 9em;
            height: 6em;
            background-color:rgb(70, 82, 43);
            color: black;
            border-radius: 1em;
            display: inline-block;
            position: relative;
        }
        soundbox.unbuffered {
            filter:sepia(1)
        }
        soundbox.cuenow {
            background-color:lightblue;
        }
        soundbox span {
            z-index:1;
        }
        .liner {
            width:100%;
            height:100%;
            position:absolute;
            display:block;
        }
        moodbar {
            background-size: contain;
            filter: blur(3.14159px);
        }
        moodbar.mask {
            background: url(vertical_mid_fade.webp);
            mix-blend-mode:soft-light;
        }
        div {
            border: 3px solid rgb(25, 77, 28);
            border-radius: 3em;
            padding: 1em;
        }
    </style>

