<script lang="ts">
    let {playlets} = $props()
    // figures approach,
    let cuelets = $state([])
    // active-ish subset of them:
    let near = $state([])
    // play them all in sequence
    let i = $state(0)
    // < time, fading, etc
    $effect(() => {
        // < buffering
        sync_cuelets(playlets)
        let alsonear = near = [cuelets[i],cuelets[i+1]]
        console.log("Buffering: ",{alsonear,cuelets})
    })
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
                cuelet = {in:playlet.in}
                cuelets.push(cuelet)
            }
            sync_cuelet(cuelet,playlet)
        })
        tr.done()
    }
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