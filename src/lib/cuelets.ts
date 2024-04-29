
import { untrack } from "svelte"
import { fetch,dec } from "./FFgemp"
import type { quadjustable, amode, amodes, adublet,acuelet } from "./FFgemp"

// a [cuelet+] represents a sequence of chunks of the media we encoded
class SyncableCueleter {
    // the ! stop ts error about not being defined in the
    //  constructor (which doesn't exist on this base class)
    public cuelets!:acuelet[]
    public sel!:object
    public needle_uplink!: null | object
    public audioContext!: null | object

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

    // handles wraparound
    next_cuelet(cuelet) {
        let i = this.cuelets.indexOf(cuelet)
        if (i < 0) {
            // is fine, will go back to the start when file changes
        }
        let one = this.cuelets[i+1] || this.cuelets[0]
        if (!one) throw "no next!"
        return one
    }
}
class SpasmableCueleter extends SyncableCueleter {
    public spasm_control!:null|object
    get time() {
        let time = this.audioContext.currentTime
        return time
    }
    
    // now manage a slight queue of things to listen to
    // we attend this regularly
    spasm({modus,con,fed={}}): void {
        if (con != this.spasm_control) return
        fed ||= {}
        // they may will to come back at certain times
        let def  = {nexttime:0.5}
        def.comebackin = (time) => {
            def.nexttime = Math.min(def.nexttime,time)
        }
        // from async time
        def.comeback = () => {
            // defeats spasm_control because this callback must occur
            //  yet is serviced by this general "attend modus" function
            this.spasm({modus,con:this.spasm_control,fed:def})
        }

        modus.map((mo:Modus) => {
            if (!mo.orch) {
                // mo gets made orch exists, so introduce them
                mo.hello({orch:this})
            }

            // and some scheme for scheduling Ziplets
            let c = mo.next_c || {}
            delete mo.next_c
            mo.attend({def,fed,c})
        })
        comeback(() => this.spasm({modus,con,fed:def}), def.nexttime)
    }
}

// base class of a playback modus
class Modus {
    public orch:Cueleter
    public gain
    // a little instruction object to pass to the next attend
    public next_c:null|object

    constructor() {}
    // mo gets made before orch exists, so introduce them
    hello({orch}) {
        this.orch = orch
        // each modus has a fader
        this.gain = this.orch.audioContext.createGain();
        this.gain.connect(this.orch.audioContext.destination)
    }
}
// for looping through cuelets in sequence
export class ModusCueletSeq extends Modus {
    // the most present source material
    public cuenow:acuelet
    // the most present bit of sound
    public zip:Ziplet

    attend({def,c}) {
        if (!this.orch.cuelets[0]) debugger

        // c.go may be passed in|along
        if (!this.cuenow) c.go = 1
        if (c.go) {
            this.cuenow = this.orch.next_cuelet(this.cuenow)
            this.go_cuenow({def,c})
            console.log("Playing "+this.cuenow.in)
        }
    }

    go_cuenow({def,c}) {
        if (!this.cuenow?.buffer) return console.warn("!ModusCueletSeq.cuenow.buffer",this)
        // this one time we play this cuelet
        this.zip = new Ziplet({orch:this.orch, mo:this, cuelet:this.cuenow})
        // play
        this.zip.start()

        this.plan_crossfade({def,c})
    }

    plan_crossfade({def,c}) {
        let zip = this.zip
        let cuenow = this.cuenow
        let still_in_control = () => this.cuenow == cuenow
        let cuenext = this.orch.next_cuelet(cuenow)
        let continuity = cuenext.in == cuenow.out
        
        // two ways to attend the end:
        // a bit early, to do a crossfade
        if (!continuity) {
            // crossfading discontinuity, probably from looping
            // the next thing might not be buffered yet!
            let duration = zip.duration || 2000
            let left = duration - fadetime
            // return console.log("Wanna comeback in "+left)
            
            // < can this become a persistent assertion?
            //    ie created every time
            //     actioned by the last possible attend()
            setTimeout(() => {
                if (still_in_control()) {
                    // needle.opacity.set(0,{duration:fadetime*1000})
                    this.next_c = {go:1}
                    def.comeback()
                    // scheduleNextSound({fadein:fadetime})
                }
            }, left * 1000)
        }
        // or simply ending (buffered audio means no tiny gap)
        zip.source.onended = () => {
            // if nobody else (crossfading, ~cuelets) has altered cuenow since we started
            // cuenext will already be cuenow|playing if crossfading
            if (still_in_control()) {
                this.next_c = {go:1}
                def.comeback()
            }
        };
    }
}

// < should be part of sel
let fadetime = 1.5
// some sound to play
class Ziplet {
    public orch:Cueleter
    public mo:Modus
    // one we replace on mo
    public fade_in_over_zip:Ziplet

    public gain
    // in the Web Audio sense
    public source
    // .buffer comes from
    public cuelet

    get duration():number {
        let dur = this.source?.buffer?.duration
        if (dur == null) throw "!duration"
        return dur
    }
    get ends_at() {
        if (this.cuelet.startTime == null) throw "!startTime"
        return this.cuelet.startTime + this.duration
    }
    get time_left() {
        let time = this.orch.time
        let left = this.ends_at - this.orch.time
        if (left < 0) left = 0
        return left
    }

    constructor({orch,mo,cuelet}) {
        this.orch = orch
        this.mo = mo
        // each ziplet feeds into modus
        this.gain = this.orch.audioContext.createGain();
        this.gain.connect(this.mo.gain)

        // < input could also be the source file itself?
        cuelet && this.load_cuelet(cuelet)

        // we may fade over the rest of whatever is playing
        if (mo.zip) this.fade_in_over_zip = mo.zip
    }
    // cuelet brings the buffer, duration
    // < and relativity to selection
    load_cuelet(cuelet) {
        this.cuelet = cuelet
        this.source = this.orch.audioContext.createBufferSource()
        this.source.buffer = this.cuelet.buffer
        if (!this.duration) debugger
        this.source.connect(this.gain)
    }
    start() {
        let time = this.orch.time
        this.cuelet.startTime = time
        this.source.start(time)
        let ozip = this.fade_in_over_zip
        if (ozip) this.fade_in_over(ozip)
    }
    fade_in_over(ozip) {
        // crossfade from last
        // supposing the fadetime is built in to their current overlap
        let left = ozip.time_left
        if (left > this.duration+0.001) {
            // going to get weird
            debugger
        }
        if (left == 0) return
        console.log("Crossfading: "+left)
        fadein(this,left)
        fadeout(ozip,left)
    }
}

// these?
function fade(zip,sudden_val,thence_val,fadetime:number) {
    let time = zip.orch.time
    zip.gain.gain.setValueAtTime(sudden_val, time);
    zip.gain.gain.linearRampToValueAtTime(thence_val, time + fadetime);
}
function fadein(zip,fadetime) {
    fade(zip,0,1,fadetime)
}
function fadeout(zip,fadetime) {
    fade(zip,1,0,fadetime)
}

export class Cueleter extends SpasmableCueleter {
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