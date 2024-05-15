<script lang=ts>
    import Schaud from "./Schaud.svelte";
    import KnobTime from "./ui/KnobTime.svelte";

    let {sel,needle_uplink,on_reselection,chunk_length,duration} = $props()

    let playlets = $state([])
    $effect(() => {
        playlets = sel.playlets || []
    })
    // of the whole File
    type tracktime = number
    // and the selection as a separate expanse, starting from 0
    // of between first cuelet.in and last cuelet.out
    //  aka intime etc see class Cuelet / localise_time():
    //   this.intime = this.in - sel.in
    type looptime = number

    // accept adjustments, may quickly adjust play
    //  set into an object owned by Zone...
    let in_time:tracktime = $state(30)
    let out_time:tracktime = $state(36)
    sel.set({
        in_time,
        out_time,
    })
    // shunt upwards when time needs expanding
    $effect(() => {
        // inclusively select dublet spaces
        let fel = {
            in: Math.floor(in_time / chunk_length) * chunk_length,
            out: Math.ceil(out_time / chunk_length) * chunk_length,
        }
        if (fel.in != sel.in || fel.out != sel.out) {
            let first_ever = sel.in == null
            // non-reactively set it here
            sel.set(fel)
            console.log("Selection Woke",sel)
            // then cause a reaction
            !first_ever && on_reselection()
        }
        else {
            console.log("Selection zzzz",sel)
        }
    })

    let selin = $state()
    let selout = $state()
    let selmo = $state(0)
    let selmo_was = 0
    let nomore = 0
    // pull to Knobs
    $effect(() => {
        selin = in_time
        selout = out_time
        console.log(" <- inout_time")
    })
    // push to sel
    $effect(() => {
        selmo && add_selmo()
        range_sanity()

        in_time = selin
        out_time = selout
        console.log("inout_time <- ")
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

    let min_loop_duration:looptime = 4
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
    {#if playlets.length}
        <Schaud {playlets} {needle_uplink} {sel} {on_reselection}>
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