<script lang=ts>
    import Schaud from "./Schaud.svelte";
    import Knob from './Knob.svelte';

    let {sel,needle_uplink,on_reselection,chunk_length,duration} = $props()

    let playlets = $state([])
    $effect(() => {
        playlets = sel.playlets || []
    })

    // accept adjustments, may quickly adjust play
    //  set into an object owned by Zone...
    let in_time = $state(30)
    let out_time = $state(36)
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

    let min_loop_duration = 4
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


    // < GOING from here on..?
    let precise = $state('')
    let wert = {}
    let unwert = (s,k) => {
        let was = wert[k]
        wert[k] = s[k]
        return s[k] != was
    }
    $effect(() => {
        let check_startend_within_inout = false
        if (unwert(sel.in) && sel.in != selin) {
            console.log(`Schaud <- sel.in: ${selin} <- ${sel.in}`)
        }
        if (unwert(sel.out) && sel.out != selout) {
            console.log(`Schaud <- sel.out: ${selout} <- ${sel.out}`)
            
        }
    })
    const obj = {
    log: ["example", "test"],
    get latest() {
        if (this.log.length === 0) return undefined;
        return this.log[this.log.length - 1];
    },
    };
    console.log("Shacu ",obj)





    let magic = $state('')

    magic = "also"
    setTimeout(() => {
    magic = "dingbat"
    },1500)

</script>

<p> selection:{sel.id}
    {#if playlets.length}
        <Schaud {playlets} {needle_uplink} {sel} {on_reselection}>
            {#snippet leftend(width_per_s)}
                <span>
                    in
                    <Knob min={sel.in-10} max={sel.in+10} 
                        bind:value={selin}
                        {commit} ></Knob>
                    move
                    <Knob min={-30} max={+30} 
                        bind:value={selmo}
                        {commit} ></Knob>
                    @ {precise}
                </span>
            {/snippet}
            {#snippet rightend(width_per_s)}
                <span>
                    out
                    <Knob min={sel.out-10} max={sel.out+10} 
                    bind:value={selout}
                    {commit} ></Knob>
                </span>
            {/snippet}
        </Schaud>
        <p>BTW: {magic}</p>
    {:else}
        <p>...</p>
    {/if}
 </p>