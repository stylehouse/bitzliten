<script lang="ts">
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
        return cuelets[i+1] || cuelets[0]
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
            source.start(audioContext.currentTime);

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
    // round number
    function dec(s,places=4) {
        s = s*1
        if (isNaN(s)) throw "ohno"
        return s.toFixed(places) * 1
    }
</script>

<div>*audio* {upto}</div>

    <style>
        div {
            border: 3px solid rgb(25, 77, 28);
            border-radius: 3em;
            padding: 1em;
        }
    </style>

