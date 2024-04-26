<script lang="ts">
    import { tweened } from 'svelte/motion';
	import { fade,scale } from 'svelte/transition';
    import { fetch,dec } from "./FFgemp"
    import { Cueleter, ModusCueletSeq } from "./cuelets"
    import type { quadjustable, amode, amodes, adublet,acuelet } from "./FFgemp"
    import Pointer from './Pointer.svelte';
    import Cuelets from './ui/Cuelets.svelte';
    import { onDestroy, untrack } from 'svelte';

    let {
        playlets,
        needle_uplink,
        sel,
        on_reselection,
        // snippets
        leftend,rightend,
    } = $props()

    // figures approach,
    let cuelets = $state([])
    let orch
    let audioContext:AudioContext
    $effect(() => {
        orch = new Cueleter({cuelets,sel,needle_uplink})
        audioContext = orch.audioContext
    })

    // playlets -> cuelets
    $effect(() => {
        orch.sync_cuelets(playlets)
    })
    // handles wraparound
    function next_cuelet(cuelet) {
        let i = cuelets.indexOf(cuelet)
        if (i < 0) {
            // is fine, will go back to the start when file changes
        }
        let one = cuelets[i+1] || cuelets[0]
        if (!one) throw "no next!"
        return one
    }

    let modus = $state([])
    // our default thing to do
    modus[0] = new ModusCueletSeq()
    
    function newSpasm() {
        let con = orch.spasm_control = {}
        orch.spasm({modus,con})
    }
    onDestroy(() => orch.spasm_control = {})



// our loop
    let ready = $state(0)
    $effect(() => {
        if (cuelets[0]?.buffer) ready = 1
    })
    $effect(() => {
        if (ready) scheduleNextSound()
        if (ready) newSpasm()
    })
    function thump_machinery() {
        if (cuenow && cuenow.source) delete cuenow.source
        cuenow = null
        ready = ready + 1
        scheduleNextSound()
        modus.map(mo => {
            delete mo.cuenow
        })
        newSpasm()
    }
    let fadetime = 1.5
    let upto = $state(0)
    type acuelet = adublet & {startTime:number,source,needle,el}
    let cuenow:null|adublet = null
    // a new cuenow needs to .source and .play()
    function scheduleNextSound(c?) {
        return
        c ||= {}
        let remarks = []
        // some weird time to avoid.
        if (!cuelets[0]) return
        // on init
        cuenow ||= cuelets[0]
        if (!cuenow) throw "!cuenow"
        // this shall remain the same for source.onended()'s callback
        let cuelet = cuenow
        // one of these while playing
        if (!cuenow.source) {
            remarks.push("new")
            let source = cuenow.source = source_cuelet(cuenow)

            // this will find the same one unless crossfading
            let needle = cuenow.needle = find_unused_needle()
            // crossfade from last
            if (c.fadein) {
                source.fadein(c.fadein)
            }

            // play
            cuenow.startTime = audioContext.currentTime
            source.start(audioContext.currentTime);
            up_displaytime()
            if (c.fadein) {
                // clobber the default opacity tween to match the fadetime
                needle.opacity.set(0)
                needle.opacity.set(1,{duration:fadetime*1000})
            }

            // crossfade to next
            let cuenext = next_cuelet(cuenow)
            if (cuenext.in != cuenow.out) {
                // discontinuity, probably from looping
                // the next thing might not be buffered yet!
                let duration = source.buffer?.duration || 2000
                let left = duration - fadetime
                remarks.push("crossfade in "+left)
                setTimeout(() => {
                    // this may occur after a cuelets[] rearrangement
                    if (cuelet != cuenow) return console.warn("give up scheduleNextSound() control")
                    // this will go back to [0] if no such cuenow
                    cuenext = next_cuelet(cuenow)
                    cuelet.source.fadeout(fadetime)
                    needle.opacity.set(0,{duration:fadetime*1000})
                    cuenow = cuenext
                    scheduleNextSound({fadein:fadetime})
                },left * 1000)
            }


            source.onended = () => {
                // console.log(`Ends ${cuelet.in} ne:${needle.id}`,cuelets.map(cu => cu.needle))
                // on the cuelet that was cuenow when it started playing
                delete cuelet.source
                delete cuelet.needle
                // cuenext will already be cuenow and playing (has .source) if crossfading
                if (cuelet == cuenow) {
                    // nobody else (crossfading, ~cuelets) has altered cuenow since we started
                    cuenow = cuenext
                    scheduleNextSound();
                }
            };
        }

        upto = cuelet.in
        
        if (!cuelets.includes(cuenow)) remarks.push("!in")
        if (cuenow.needle) remarks.push("ne:"+cuenow.needle.id)

        // console.log(`NextSound: ${cuelet.in}  ${dec(audioContext.currentTime)}  ${remarks.join("  ")}`)


    }
    type asource = AudioBufferSourceNode & {fadein:Function,fadeout:Function}
    function source_cuelet(cuelet:adublet):asource {
        let source:asource = audioContext.createBufferSource() as asource;
        source.buffer = cuelet.buffer;


        // Create a gain node to control the volume
        const gain = audioContext.createGain();
        source.connect(gain);
        gain.connect(audioContext.destination);

        // fades
        let fade = (suddenly,thence,fadetime:number) => {
            gain.gain.setValueAtTime(suddenly, audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(thence, audioContext.currentTime + fadetime);
        }
        source.fadein = (fadetime) => fade(0,1,fadetime)
        source.fadeout = (fadetime) => fade(1,0,fadetime)

        return source
    }
    function oscil() {
        const oscillator = audioContext.createOscillator();
        // Set the oscillator type to sine wave
        oscillator.type = 'sine';
        // Set the frequency to 60Hz
        oscillator.frequency.value = 260;
        return oscillator
    }

    let displaytime = $state(0)
    $effect(() => {
        cuenow
        up_displaytime()
    })
    
    let theone = {}
    let has_tween = null
    let audio_state = ''
    function up_displaytime(the) {
        if (the && the != theone) return
        the = theone = {}
        setTimeout(() => up_displaytime(the), 166)

        if (!(cuenow && cuenow.el)) return
        
        let length = sel.out - sel.in
        // a repeating time measure
        let loop_startTime = cuenow.startTime - cuenow.intime
        let loop_time = audioContext.currentTime - loop_startTime
        displaytime = dec(loop_time)
        let cue_time = audioContext.currentTime - cuenow.startTime

        check_time_is_passing(cue_time)
        if (audioContext.state == 'running') needle_moves(cue_time)
    }

    needle_uplink.stat = () => {
        if (!cuenow || !cuenow.buffer) return {}
        let duration = cuenow.buffer.duration
        let cue_time = audioContext.currentTime - cuenow.startTime
        let remains = duration - cue_time
        return {cuenow,remains,cue_time,duration}
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
    function find_unused_needle() {
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

    function needle_moves(cue_time) {
        // occasionally generate bad data from ffmpeg, eg if seek > file length
        if (!cuenow.source.buffer) return
        // do the rest once per cuenow
        if (has_tween == cuenow) return
        has_tween = cuenow
        // 1-2 needles exist
        let needle = cuenow.needle
        if (!needle) return
        if (!needle) throw '!needle'

        // we come here right after sound.start()
        if (cue_time > 0.05) console.warn("long time to needle_moves: "+cue_time)

        let cueswidth = cuenow.el.offsetWidth
        let source = cuenow.source
        let duration = source.buffer.duration
        let progress = cue_time / source.buffer.duration
        let some_left = progress * cueswidth
        needle.opacity.set(1,{duration:0.2*1000})
        needle.left.set(cuenow.el.offsetLeft*1 + some_left)
        needle.left.set(cuenow.el.offsetLeft*1 + cueswidth*1,{duration:duration*1000})
        needle.top.set(cuenow.el.offsetTop)
        // console.log(`needle_moves: @ ${displaytime} \t${progress} of ${dec(duration)}\t`)
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
    function start_from_gesture() {
        delete cuenow.source
        scheduleNextSound()
    }

    function cuelet_class(cuelet) {
        return cuelet.buffer ? '' : 'unbuffered'
    }
    function cuelet_info(cuelet) {
        let msg = []
        // 
        msg.push(cuelet.in)
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
    // < pixels width per second
    let width_per_s = 100
</script>

<div>*audio* {upto}:
     <!-- {displaytime} -->
     {audio_state}
    </div>
<div>
    <span>
        <span>
            <button onclick={thump_machinery}>thump</button>
            {@render leftend(width_per_s)}
        </span>

        <!-- <Cuelets {cuelets} {cuelet_class} {cuelet_info} /> -->
        {#each cuelets as cuelet (cuelet.in)}
        <!-- transition:scale -->
            <soundbox 
                class={cuelet_class(cuelet)}
                bind:this={cuelet.el}
                >
                &nbsp; {cuelet_info(cuelet)}
            </soundbox>
        {/each}

        <span>
            {@render rightend(width_per_s)}
        </span>
        
    <!-- 
             -->
    
    {#each needles as ne (ne.id)}
        <Pointer {ne}  />
    {/each}

    {#if it_seems_not_to_play}
        <bigdiv transition:scale onclick={start_from_gesture}>
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
        }
        soundbox.unbuffered {
            background-color:rgb(40, 46, 25);
        }
        soundbox.cuenow {
            background-color:lightblue;
        }
        div {
            border: 3px solid rgb(25, 77, 28);
            border-radius: 3em;
            padding: 1em;
        }
    </style>

