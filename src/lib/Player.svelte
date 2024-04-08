<script lang="ts">
    async function tryhitplay(el) {
        if (!el) return
        try { await el.play() }
        catch (er) {
            if (er.name == "NotAllowedError") return
            throw er
        }
    }
    import type { quadjustable, amode, amodes, adublet,acuelet } from "./FFgemp"
    let {playlets} = $props()
    // figures approach,
    let cuelets = $state([])
    // active-ish subset of them:
    let near = $state([])
    // the firstmost in and lastmost out of playlets
    let sel
    function init_sel() {
        if (!playlets[0]) return
        sel = {in: playlets[0].in,out: playlets.slice(-1)[0].out}
    }

    // < fading, etc
// playlets -> cuelets
    $effect(() => {
        // < buffering
        console.log("SYNC CLUELETS")
        init_sel()
        sync_cuelets(playlets)
    })

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
    }
    // map the in|out points (datum from start of the track)
    //  to time, which starts at 0
    function localise_time(cuelet) {
        if (sel.in == null) throw "!sel.in"
        cuelet.intime = cuelet.in - sel.in;
        cuelet.outtime = cuelet.out - sel.in;
    }

    // handles wraparound
    function next_cuelet(cuelet) {
        let i = cuelets.indexOf(cuelet)
        if (i < 0) throw "!cuelet"
        return cuelets[i+1] || cuelets[0]
    }

// our loop
    let time = 0
    let spinning = $state(0)
    let amo = 0.5
    // cuelets (may) have <audio> states
    $effect(() => {
        tapiate()
    })
    // sanity check each out,in point perfectly aligns
    $effect(() => {
        let la_out = null
        cuelets.map((cuelet,i) => {
            if (la_out && la_out != cuelet.intime) {
                throw "1.out != 2.in"
            }
            la_out = cuelet.outtime
        })
    })

    // proto v2
    // watch this cuelet play out
    //  it is undef for less time than cuenext
    let cuenow:null|acuelet = $state()
    // <audio> to come along, what to switch to
    let cuenext:null|acuelet = $state(null)
    function init_cuenow() {
        cuenow = cuelets[0]
        if (!cuenow) throw "!cuenow"
        near = [cuenow]
        if (sel.in == null) throw "!sel.in"
    }
    // how close we have to be to the ideal time to hit play()
    let accuracy = 0.001
    let tapiate_pending = false
    function dec(s,places=4) {
        s = s*1
        if (isNaN(s)) throw "ohno"
        return s.toFixed(places) * 1
    }
    function set_time(to) {
        time = dec(to)
    }
    let theone = {}
    function tapiate(the) {
        let no_return = false
        if (the) {
            // a loop we want to dedup
            if (the != theone) {
                no_return = true
            }
            else {
                theone = {}
            }
        }
        let remarks = []
        if (time == null) return
        if (!cuenow) init_cuenow()
        if (!cuenow) throw "!cuenow"
        if (!cuenow.el) {
            return console.log("tapiate() no el yet")
        }
        // a delay to keep updating time from the player,
        //  causing a loop of coming in here again
        let return_in:null|number = 0.6
        let is_switching = false
        
        if (time == cuenow.intime) {
            tryhitplay(cuenow.el)
            remarks.push(`play ${cuenow.in}`)
            if (cuenow.in >= 16) {
                // debugger
            }
        }
        let length = cuenow.outtime - cuenow.intime
        let isat = cuenow.el.currentTime
        let left = length - isat
        left = left.toFixed(4)*1
        if (left < 2) {
            // <audio> to come along, what to switch to
            remarks.push(`   (-${left})`)
            cuenext = next_cuelet(cuenow)
            if (!near.includes(cuenext)) {
                near.push(cuenext)
                remarks.push("near cuenext")
            }

            let wrapping = cuenext.in < cuenow.in

            if (left < accuracy) {
                // close enough to go it
                if (left < 0) {
                    remarks.push("gapped "+left)
                    left = 0
                }

                if (!cuenext.el) throw "cuenext still not <audio>"
                // make timing perfect
                if (wrapping) {
                    remarks.push("wrapped")
                    if (cuenext.intime != 0) throw "!0"
                    set_time(cuenext.intime)
                }
                else {
                    set_time(cuenow.outtime)
                }
                cuenow = cuenext
                cuenext = null
                is_switching = true
                remarks.push("-> "+cuenow.in)
            }
            else if (left < accuracy*5) {
                // almost there
                remarks.push("almost")
                return_in = left-accuracy*3
            }
            else {
                // aiming a little early gives better results
                // < is it better to handleAudioEnded(cuelet) -> play() next?
                let better = Math.min(return_in, left - accuracy*4)
                if (better != return_in) remarks.push("aiming")
                return_in = better
            }
        }

        // round it nice
        return_in = dec(return_in)
        console.log(`tapiate() @ ${time} for ${return_in}  ${remarks.join("  ")}`)

        if (is_switching) {
            // to change cuelet, we go through here when time==.intime
            return tapiate(theone)
        }

        if (no_return) return console.log("tapiate() ZOMBIE")
        if (tapiate_pending) return
        tapiate_pending = true
        let theone_was = theone
        setTimeout(() => {
            tapiate_pending = false
            cuenow = cuenow
            if (!cuenow.el) return console.log("wind tapiate() !el")
            let isat = cuenow.el.currentTime
            set_time(cuenow.intime*1 + isat*1)
            // console.log("wind tapiate() @"+time)
            // < setting time isn't enough to redo this effect
            //   (gone code) had to do tapiations++ here and tapations&&1 there to react
            tapiate(theone_was)
        },return_in*1000)
    }


    // cuelet finishes having <audio>
    function handleAudioEnded(cuelet) {
        setTimeout(() => {
            console.log("<audio> ended: "+cuelet.in)
            // <audio> goes away
            delete cuelet.el
            near = near.filter(n => n != cuelet)
        },amo*1000)
    }



</script>

<div>
{#each cuelets as cuelet (cuelet.in)}
    {#if near.includes(cuelet)}
        <audio src={cuelet.objectURL}
            bind:this={cuelet.el}
            on:ended={() => handleAudioEnded(cuelet)}
            controls/>
    {:else}
        o
    {/if}

{/each}
</div>


<style>
    div {
        border: 3px solid rgb(25, 77, 28);
        border-radius: 3em;
        padding: 1em;
    }
</style>