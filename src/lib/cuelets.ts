
import { untrack } from "svelte"
import { fetch,dec } from "./FFgemp"
import type { quadjustable, amode, amodes, adublet,acuelet } from "./FFgemp"


class SyncableCueleter {
    sync_cuelets(playlets) {
        console.log("SYNC CLUELETS")
        let tr = transact_goners(this.cuelets)
        let unhad:acuelet[] = this.cuelets.slice()
        playlets.map((playlet:adublet) => {
            let cuelet:any = this.cuelets.find((cuelet) => cuelet.in == playlet.in)
            if (cuelet) {
                tr.keep(cuelet)
            }
            else {
                // create it
                cuelet = {in:playlet.in,out:playlet.out}
                this.cuelets.push(cuelet)
            }
            this.sync_cuelet(cuelet,playlet)
        })
        tr.done()
        // and put them in the right order
        this.cuelets = this.cuelets.sort((a,b) => a.in - b.in)
    }
    // it may have just been created
    sync_cuelet(cuelet:acuelet,playlet:adublet) {
        // link to origin
        cuelet.playlet = playlet
        // find playable
        let dublet = playlet.ideal_dub || playlet.vague_dub
        cuelet.objectURL = dublet?.objectURL
        // < doing this already (we ) stops the first player playing. wtf
        // else if (playlet.objectURL) {
        //     cuelet.objectURL = playlet.objectURL
        // }
        // intime|outtime start from 0
        this.localise_time(cuelet)
        this.decodeAudio(cuelet)
    }
    decode_error(cuelet:acuelet) {
        let nu = this.needle_uplink
        nu && nu.bad_playlet && nu.bad_playlet(cuelet.playlet)
    }
    // map the in|out points (datum from start of the track)
    //  to time, which starts at 0
    localise_time(cuelet:acuelet) {
        if (this.sel.in == null) throw "!sel.in"
        cuelet.intime = cuelet.in - this.sel.in;
        cuelet.outtime = cuelet.out - this.sel.in;
    }
    // convert objectURL to buffer
    // we can start playing cuelets before they all have
    async decodeAudio(cuelet:acuelet) {
        if (!cuelet.objectURL) return

        if (untrack(() => cuelet.buffer)) return

        let buf = await fetch(cuelet.objectURL)
        // our fetch() returns a Uint8Array!
        let res = new Response(buf)
        let blob = await res.arrayBuffer()
        // some kind of bad data happens when <1k
        // < find out what exactly. seeking off the end of the source?
        if (blob.byteLength < 1000) {
            console.warn("Bad dub")
            this.decode_error(cuelet)
            let decode_error
            try {
                cuelet.buffer = await this.audioContext.decodeAudioData(blob)
            }
            catch(er) {
                decode_error = er
            }
            // always happens when buffer <1k
            if (!decode_error) debugger
            if (!decode_error.message.includes('Unable to decode audio data')) debugger
            console.error("cuelet <1k: ",{cuelet,buf,res,blob,decode_error})
            // we will fail to play until re-dubbed
            return
        }
        // < flipping the order of these next two lines always makes .blob_size=0 wtf
        cuelet.blob_size = blob.byteLength
        cuelet.buffer = await this.audioContext.decodeAudioData(blob)
    }
}
class SpasmableCueleter extends SyncableCueleter {
    // now manage a slight queue of things to listen to
    spasm({modus,con,fed={}}): void {
        if (con != this.spasm_control) return console.log("spasm--")
        fed ||= {}
        let def  = {}

        // they may will to come back at certain times
        let nexttimes = [0.5]
        modus.map(mo => {
            if (mo.cuelet_seq != null) {
                console.log("Gotint ")
            }
        })
        comeback(() => this.spasm({modus,con,fed:def}), nexttimes)
    }
}
export class Cueleter extends SpasmableCueleter {
    public cuelets:object[]
    public sel:object
    public needle_uplink:null|object

    public spasm_control:null|object

    constructor({cuelets,sel,needle_uplink}) {
        super()
        this.cuelets = cuelets
        this.sel = sel
        this.needle_uplink = needle_uplink
        this.audioContext = new AudioContext()
    }
}

// f
    // comeback
    function comeback(cb,time) {
        if (typeof time == 'object') {
            // a list of times we need to be back
            //  assumes attending the first one regenerates the set
            time = Math.min(...time)
        }
        setTimeout(cb,time*1000)
    }

    // maintain|whittle an array
    //  removing items without keep(z) before done().
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