<script lang=ts>
    import Schaud from "./Schaud.svelte";
    import KnobTime from "./ui/KnobTime.svelte";
    import { Sele } from "./cuelet_precursor.svelte";

    let {sel,needle_uplink,duration} = $props()

    // of the whole File
    type tracktime = number
    // and the selection as a separate expanse, starting from 0
    // of between first cuelet.in and last cuelet.out
    //  aka intime etc see class Cuelet / localise_time():
    //   this.intime = this.in - sel.in
    type looptime = number

    // accept adjustments, may quickly adjust play
    //  set into an object owned by Zone...
    let in_time:tracktime = $state(sel.in != null ? sel.in : 30)
    let out_time:tracktime = $state(sel.out != null ? sel.out : 36)
    // < precise time should be somewhere, currently not needed?
    // sel.set({
    //     in_time,
    //     out_time,
    // })
    // shunt upwards when time needs expanding
    $effect(() => {
        sel.on_adjust({in:in_time,out:out_time})
    })
    $effect(() => {
        let etc = sel.in +'-'+ sel.out
        console.log("Sele: "+etc)
    })
    // pull to Knobs
    let selin = $state(in_time)
    let selout = $state(out_time)
    let selmo = $state(0)
    let selmo_was = 0
    let nomore = 0
    // push to sel
    $effect(() => {
        selmo && add_selmo()
        range_sanity()

        in_time = selin
        out_time = selout
        // console.log("inout_time <- ")
    })
    function add_selmo() {
        // difference from last tiny adjustment
        //  during a single grasp of the Knob
        let move = selmo - selmo_was
        selmo_was = selmo
        // move the whole selection
        selin += move*1
        selout += move*1
    }
    function commit() {
        // re-center selmo when let go
        selmo = 0
        selmo_was = 0
    }

    let min_loop_duration:looptime = sel.enc.chunk_length*2
    function range_sanity() {
        // in before start
        if (selin < 0) {
            selin = 0
        }
        // in > out
        // < should selin be like selmo?
        if (selin + min_loop_duration > selout) {
            selout = selin + min_loop_duration
        }
        // out beyond end
        if (duration != null && selout > duration) {
            console.log(`Too far out: ${selout} > ${duration}`)
            selout = duration
            // then selin may be too far as well
            if (selin + min_loop_duration > selout) {
                selin = selout - min_loop_duration
                // but not if before start (tiny file?)
                if (selin < 0) {
                    selin = 0
                }
            }
        }
    }
    function locator_grit(fromtime,totime,width_per_s) {
        let delta = fromtime - totime
        return delta * width_per_s
    }
</script>

<div> Selection:{sel.id}
    {#if sel.playlets.length}
        <Schaud {needle_uplink} {sel} >
            {#snippet leftend(cueletsin:tracktime, width_per_s)}
                <span>
                    <dof style="margin-top:15em;">
                        <KnobTime range=60
                            bind:value={selmo}
                            {commit} >
                            {#snippet label()}
                                move
                            {/snippet}
                        </KnobTime>
                    </dof>
                </span>
                <span>
                    <grit class="openbracket"
                        style="left:{-locator_grit(cueletsin,selin,width_per_s)}px">
                        <KnobTime
                            bind:value={selin}
                            {commit} >
                            {#snippet label()}
                                in
                            {/snippet}
                        </KnobTime>
                    </grit>
                </span>
            {/snippet}
            {#snippet rightend(cueletsout:tracktime, width_per_s)}
                <span>
                    <grit class="closebracket"
                        style="right:{locator_grit(cueletsout,selout,width_per_s)}px">
                        <KnobTime
                            bind:value={selout}
                            {commit} >
                            {#snippet label()}
                                out
                            {/snippet}
                        </KnobTime>
                    </grit>
                </span>
            {/snippet}
        </Schaud>
    {:else}
        <p>...</p>
    {/if}
</div>

<style>
    div span {
        position:relative;
    }
    grit {
        position:absolute;
        z-index:1;
        padding-left:-0.5em;
    }
    .openbracket {
        border-radius:1em;
        border-left:3px solid lavender;
    }
    .closebracket {
        border-radius:1em;
        border-right:3px solid lavender;
    }
</style>