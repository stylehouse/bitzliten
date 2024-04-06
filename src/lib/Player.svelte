<script lang="ts">
    async function tryhitplay(el) {
        if (!el) return
        try { await el.play() }
        catch (er) {
            if (er.name == "NotAllowedError") return
            throw er
        }
    }
    let {playlets} = $props()
    // figures approach,
    let cuelets = $state([])
    // active-ish subset of them:
    let near = $state([])
    // the firstmost in and lastmost out of playlets
    let sel

    // < time, fading, etc
    // playlets -> cuelets
    $effect(() => {
        // < buffering
        console.log("SYNC CLUELETS")
        sel = {in: playlets[0].in,out: playlets.slice(-1)[0].out}
        sync_cuelets(playlets)
    })

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
            let {intime,outtime} = get_inouttime(cuelet)
            if (la_out && la_out != intime) {
                throw "1.out != 2.in"
            }
            la_out = outtime
        })
    })

    // proto v2
    // watch this cuelet play out
    let cuenow = $state()
    // <audio> to come along, what to switch to
    let cuenext = $state()
    let windup = $state(0)
    function init_cuenow() {
        cuenow = cuelets[0]
        if (!cuenow) throw "!cuenow"
        near = [cuenow]
        if (sel.in == null) throw "!sel.in"
    }
    let tapiations = $state(0)
    // how close we have to be to the ideal time to hit play()
    let accuracy = 0.01
    let tapiate_pending = false
    function tapiate(the) {
        tapiations && 1
        let remarks = []
        if (time == null) return
        if (!cuenow) init_cuenow()
        if (!cuenow.el) {
            return console.log("tapiate() no el yet")
        }
        // a delay to keep updating time from the player,
        //  causing a loop of coming in here again
        let return_in = 0.6
        
        let {intime,outtime} = get_inouttime(cuenow)
        if (time == intime) {
            tryhitplay(cuenow.el)
            remarks.push(`play ${cuenow.in}`)
            if (cuenow.in >= 16) {
                // debugger
            }
        }
        let length = outtime - intime
        let isat = cuenow.el.currentTime
        let left = length - isat
        if (left < 2) {
            // <audio> to come along, what to switch to
            remarks.push(`   (-${left})`)
            cuenext = next_cuelet(cuenow)
            if (!near.includes(cuenext)) {
                near.push(cuenext)
                remarks.push("near cuenext")
            }
            if (left < accuracy) {
                // close enough to go it
                if (left < 0) {
                    remarks.push("gapped "+left)
                    left = 0
                }
                // make timing perfect
                time = outtime
                if (!cuenext.el) throw "cuenext still not <audio>"
                if (cuenext.in < cuenow.in) {
                    remarks.push("wrapped")
                }
                cuenow = cuenext
                if (!cuenow.objectURL) {
                    if (cuenow.playlet.objectURL) {
                        console.log(`cuelet ${cuenow.in} has no .objectURL`)
                        cuenow.objectURL = cuenow.playlet.objectURL
                    }
                }
                cuenext = null
                return_in = null
                remarks.push("switched to "+cuenow.in)
            }
            else {
                // aiming a little early gives better results
                return_in = left - accuracy
            }
        }

        console.log(`tapiate() @ ${time} for ${return_in}  ${remarks.join("  ")}`)

        if (return_in == null) return tapiate()

        if (tapiate_pending) return
        tapiate_pending = true
        setTimeout(() => {
            tapiate_pending = false
            cuenow = cuenow
            if (!cuenow.el) return console.log("wind tapiate() !el")
            let isat = cuenow.el.currentTime
            time = intime*1 + isat*1
            console.log("wind tapiate() @"+time)
            // < why adjusting $time isn't enough to redo this effect
            tapiations++
        },return_in*1000)
    }

    // handles wraparound
    function next_cuelet(cuelet) {
        let i = cuelets.indexOf(cuelet)
        if (i < 0) throw "!cuelet"
        return cuelets[i+1] || cuelets[0]
    }

    // map the in|out points (datum from start of the track)
    //  to time, which starts at 0
    function get_inouttime(cuelet) {
        if (sel.in == null) throw "!sel.in"
        return {
            intime: cuelet.in - sel.in,
            outtime: cuelet.out - sel.in,
        }
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


    function sync_cuelets(playlets) {
        let tr = transact_goners(cuelets)
        let unhad = cuelets.slice()
        playlets.map(playlet => {
            let cuelet = cuelets.find((cuelet) => cuelet.in == playlet.in)
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
    function sync_cuelet(cuelet,playlet) {
        cuelet.playlet = playlet

        let dublet = playlet.ideal_dub || playlet.vague_dub
        if (dublet) {
            cuelet.objectURL = dublet.objectURL
        }
        // else if (playlet.objectURL) {
        //     cuelet.objectURL = playlet.objectURL
        // }
            
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