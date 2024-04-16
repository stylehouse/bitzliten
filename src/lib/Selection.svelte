<script>
    import Schaud from "./Schaud.svelte";
    import Knob from './Knob.svelte';
    import { writable } from 'svelte/store';

    let {sel,needle_uplink,on_reselection,chunk_length} = $props()

    let playlets = $state([])
    $effect(() => {
        playlets = sel.playlets || []
    })

    // accept adjustments, may quickly adjust play
    //  set into an object owned by Zone...
    let in_time = $state(50)
    let out_time = $state(56)
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
            // non-reactively set it here
            sel.set(fel)
            // then cause a reaction
            on_reselection()
            console.log("Schaud Woke",sel)
        }
        else {
            console.log("Schaud zzzz",sel)
        }
    })

    let selin = $state()
    let selout = $state()
    let selmo = $state(0)
    // push to sel
    let nomore = 0
    $effect(() => {
        if (selin == null) return
        if (nomore) return
        return
        push_to_sel()

        nomore = 1
        setTimeout(() => {
            nomore = 0
        },220)
    })
    function push_to_sel() {
        if (0 && selmo) {
            // move the whole selection
            selin += selmo
            selout += selmo
            // gets reset to 0
            selmo = 0
        }
        let o = {in:selin,out:selout}
        console.log("Shaud -> sel",o)
        let selo = Object.assign({},sel)
        delete selo.playlets
        magic = JSON.stringify([selo,o])

        setTimeout(() => {
            // sel.input(o)
        },1000)
    }
    $inspect(sel)
    $inspect(selin)
    // pull from sel
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
        return
        if (sel?.out) {
            sel_adjustable = true
            setTimeout(() => {
                if (selin != sel.in) selin = sel.in
                if (selout != sel.out) selout = sel.out
            },10)
            // precise = sel.start +' -- '+ sel.end
            let o = {in:selin,out:selout}
            console.log("Shaud <- sel",o)
        }
        else {
            console.error("No sel.out")
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
                        commit={push_to_sel} ></Knob>
                    move
                    <Knob min={-30} max={+30} 
                        bind:value={selmo}
                        commit={push_to_sel} ></Knob>
                    @ {precise}
                </span>
            {/snippet}
            {#snippet rightend(width_per_s)}
                <span>
                    out
                    <Knob min={sel.out-10} max={sel.out+10} 
                    bind:value={selout}
                    commit={push_to_sel} ></Knob>
                </span>
            {/snippet}
        </Schaud>
        <p>BTW: {magic}</p>
    {:else}
        <p>...</p>
    {/if}
 </p>