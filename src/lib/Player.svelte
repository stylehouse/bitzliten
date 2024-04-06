<script lang="ts">
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
        sel = {in: playlets[0].in,out: playlets.slice(-1)[0].out}
        sync_cuelets(playlets)
        if (!near.length) {
            near = [cuelets[0]]
        }
    })

    // our loop
    let time = $state(0)
    let spinning = $state(0)
    let amo = 0.5
    // cuelets (may) have <audio> states
    $effect(() => {
        thinktoplay()
    })
    $effect(() => {
        cuelets.map((cuelet,i) => {

        })
    })
    function thinktoplay() {
        let la_out = null
        cuelets.map((cuelet,i) => {
            let intime = cuelet.in - sel.in
            let outtime = cuelet.out - sel.in
            // check each out,in point perfectly aligns
            if (la_out && la_out != intime) {
                throw "1.out != 2.in"
            }
            la_out = outtime

            if (time < intime || time > outtime) return
            let el = cuelet.el
            if (el) {
                // is happening
                if (time == intime) {
                    // starts
                    el.play()
                    return
                }
            }

            let thence = cuelets[i+1]
            if (!thence) {
                // loop around
                thence = cuelets[0]
            }

            // not far to go
            let left = outtime - time
            if (left < amo) {
                setTimeout(() => {
                    // ~~ call this function again
                    time = outtime
                },left*1000)
            }
            if (left < amo*2 && !cuelet.el) {
                let til_appear = Math.min(0,left - amo)
                setTimeout(() => {
                    // <audio> comes along
                    if (!near.includes(thence)) near.push(thence)
                },til_appear*1000)
            }
                // schedule the next play() event
        })
        console.log("thinktoplay()")
    }
    // cuelet finishes having <audio>
    function handleAudioEnded(cuelet) {
        setTimeout(() => {
            let outtime = cuelet.out - sel.in
            time = outtime
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