<script lang="ts">
    import { tweened } from 'svelte/motion';
    import { fetch } from "./FFgemp"
    import type { quadjustable, amode, amodes, adublet,acuelet } from "./FFgemp"

    let {playlets} = $props()
    // figures approach,
    let cuelets = $state([])
    // the firstmost in and lastmost out of playlets
    let sel
    // the mixer
    let audioContext:AudioContext
    $effect(() => {
        audioContext = new AudioContext()
    })

// playlets -> cuelets
    $effect(() => {
        // < buffering
        console.log("SYNC CLUELETS")
        init_sel()
        sync_cuelets(playlets)
    })
    function init_sel() {
        if (!playlets[0]) return
        sel = {in: playlets[0].in,out: playlets.slice(-1)[0].out}
    }

    function sync_cuelets(playlets) {
        let tr = transact_goners(cuelets)
        let unhad:acuelet[] = cuelets.slice()
        playlets.map((playlet:adublet) => {
            let cuelet:any = cuelets.find((cuelet) => cuelet.in == playlet.in)
            if (cuelet) {
                tr.keep(cuelet)
            }
            else {
                // create it
                cuelet = {in:playlet.in,out:playlet.out}
                cuelets.push(cuelet)
            }
            sync_cuelet(cuelet,playlet)
        })
        tr.done()
    }
    // maintain|whittle an array
    //  removing things not keep() before done().
    // you may push more in meanwhile
    function transact_goners(N) {
        let unhad = N.slice()
        return {
            keep: (z) => {
                unhad = unhad.filter(s => s != z)
            },
            done: (z) => {
                let deletes = unhad.map((gone) => {
                    let i = N.indexOf(gone)
                    if (i < 0) throw "gone goner"
                    return i
                })
                deletes.reverse().map(i => N.splice(i,1))
            },
        }
    }
    // it may have just been created
    function sync_cuelet(cuelet:acuelet,playlet:adublet) {
        // link to origin
        cuelet.playlet = playlet
        // find playable
        let dublet = playlet.ideal_dub || playlet.vague_dub
        if (dublet) {
            cuelet.objectURL = dublet.objectURL
        }
        // < doing this already (we ) stops the first player playing. wtf
        // else if (playlet.objectURL) {
        //     cuelet.objectURL = playlet.objectURL
        // }
        // intime|outtime start from 0
        localise_time(cuelet)
        decodeAudio(cuelet)
    }
    // map the in|out points (datum from start of the track)
    //  to time, which starts at 0
    function localise_time(cuelet) {
        if (sel.in == null) throw "!sel.in"
        cuelet.intime = cuelet.in - sel.in;
        cuelet.outtime = cuelet.out - sel.in;
    }
    // convert objectURL to buffer
    async function decodeAudio(cuelet) {
        if (!cuelet.objectURL) return
        let buf = await fetch(cuelet.objectURL)
        // our fetch() returns a Uint8Array!
        let res = new Response(buf)
        let blob = await res.arrayBuffer()
        // we can start playing cuelets before they all have:
        cuelet.buffer = await audioContext.decodeAudioData(blob)
    }
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




// our loop
    let ready = $state(0)
    $effect(() => {
        if (cuelets[0]?.buffer) ready = 1
    })
    $effect(() => {
        if (ready) scheduleNextSound()
    })
    let fadetime = 1.5
    let upto = $state(0)
    let cuenow:null|adublet = null
    // we shall run this whenever a new cuelet needs to .source and .play()
    //  also runs at random other times
    function scheduleNextSound(c?) {
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

            // crossfade from last
            if (c.fadein) {
                source.fadein(c.fadein)
            }

            // play
            cuenow.startTime = audioContext.currentTime
            source.start(audioContext.currentTime);
            up_displaytime()

            // crossfade to next
            let cuenext = next_cuelet(cuenow)
            if (cuenext.in != cuenow.out) {
                // < how to get to the time to do it more reliably?
                let left = source.buffer.duration - fadetime
                setTimeout(() => {
                    cuelet.source.fadeout(fadetime)
                    cuenow = cuenext
                    scheduleNextSound({fadein:fadetime})
                },left * 1000)
            }


            source.onended = () => {
                // on the cuelet that was cuenow when it started playing
                delete cuelet.source
                // cuenext will already be cuenow and playing (has .source) if crossfading
                //  this may trigger if we get >1 cuelet ahead of now somehow
                if (cuenow != cuelet && cuenow != cuenext) debugger
                if (cuelet == cuenow) {
                    // nobody else (crossfading) has altered cuenow since we started
                    cuenow = cuenext
                    scheduleNextSound();
                }
            };
        }

        upto = cuelet.in
        

        console.log(`NextSound: ${cuelet.in}  ${dec(audioContext.currentTime)}  ${remarks.join("  ")}`)


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
    function up_displaytime(the) {
        if (the && the != theone) return
        the = theone = {}
        setTimeout(() => up_displaytime(the), 166)

        cuelets && 1
        if (!(cuenow && cuenow.el)) return
        
        let length = sel.out - sel.in
        // a repeating time measure
        let loop_startTime = cuenow.startTime - cuenow.intime
        let loop_time = audioContext.currentTime - loop_startTime
        displaytime = dec(loop_time)
        let cue_time = audioContext.currentTime - cuenow.startTime

        check_time_is_passing(cue_time)
        
        needle_moves(cue_time)
        
    }



    // tween takes on the duration of the cuelet when .set()
    let needle_left = tweened(0,{duration:0})
    let needle_top = $state(0)
    function needle_moves(cue_time) {
        if (!cuenow.source.buffer) return
        // do the rest once per cuenow
        if (has_tween == cuenow) return
        has_tween = cuenow

        // we come here right after sound.start()
        if (cue_time > 0.05) console.warn("long time to needle_moves: "+cue_time)

        let cueswidth = cuenow.el.offsetWidth
        let source = cuenow.source
        let duration = source.buffer.duration
        // let progress = cue_time / source.buffer.duration
        // let some_left = progress * cueswidth
        // let value = {
        //     left: dec(cuenow.el.offsetLeft*1 + some_left*1),
        //     top: dec(cuenow.el.offsetTop),
        // }
        // needlepos.set(value)

        needle_left.set(cuenow.el.offsetLeft*1)
        needle_left.set(cuenow.el.offsetLeft*1 + cueswidth*1,{duration:duration*1000})
        needle_top = cuenow.el.offsetTop
        console.log(`Cuestop: @ ${displaytime} \t${dec(duration)}\t`)
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


    // round number
    function dec(s,places=4) {
        s = s*1
        if (isNaN(s)) throw "ohno"
        return s.toFixed(places) * 1
    }
</script>

<div>*audio* {upto}:
     <!-- {displaytime} -->
    </div>
<div>
    <span>
    {#each cuelets as cuelet (cuelet.in)}
        <soundbox 
            bind:this={cuelet.el} >
            www
        </soundbox>
    {/each}

    <soundneedle style="left:{$needle_left}px;top:{needle_top}px;">
        <img src="pointer.webp" />
    </soundneedle>
    {#if it_seems_not_to_play}
        <bigdiv onclick={start_from_gesture}>click here</bigdiv>
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
        }
        div span {
            position:relative;
        }
        soundneedle {
            position:absolute;
            mix-blend-mode: color-dodge;
            margin-top: -7em;
            margin-left: -7em;
            pointer-events:none;
        }
        soundbox {
            width: 9em;
            height: 6em;
            background-color:rgb(70, 82, 43);
            border-radius: 1em;
            display: inline-block;
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

