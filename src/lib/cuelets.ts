
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
type amo = {feed:ModusFeed}
class SpasmableCueleter extends SyncableCueleter {
    public spasm_control!:null|object
    
    // now manage a slight queue of things to listen to
    // we attend this regularly
    spasm({modus,con,fed={}}): void {
        if (con != this.spasm_control) return
        fed ||= {}
        // they may will to come back at certain times
        let def  = {nexttime:0.5}
        let the_comeback = (delay) => {
            
        }
        def.comebackin = (time) => {
            def.nexttime = Math.min(def.nexttime,time)
        }
        // from async time
        def.comeback = (etc) => {
            this.spasm({modus,con,fed:def}
        }

        modus.map((mo:Modus) => {
            if (!mo.orch) {
                // mo gets made orch exists, so introduce them
                mo.hello({orch:this})
            }

            // and some scheme for scheduling Ziplets
            // < they want c.go fed in somehow, per mo
            mo.attend({def,fed})
        })
        comeback(() => this.spasm({modus,con,fed:def}), def.nexttime)
    }
}

// base class of mode
class Modus {
    public orch:Cueleter
    public feed:ModusFeed
    constructor() {}
    // mo gets made before orch exists, so introduce them
    hello({orch}) {
        this.orch = orch
        // each modus has a fader
        this.gain = this.orch.audioContext.createGain();
        this.gain.connect(this.orch.audioContext.destination)
    }
}
// for sweeping through cuelets in sequence
export class ModusCueletSeq extends Modus {
    // the most present source material
    public cuenow:acuelet
    // the most present bit of sound
    public zip:Ziplet

    attend({def,c={}}) {
        if (!this.orch.cuelets[0]) debugger

        // c.go may be passed in|along
        if (!this.cuenow) c.go = 1
        if (c.go) {
            this.cuenow = this.orch.next_cuelet(this.cuenow)
            this.go_cuenow({def,c})
        }
    }

    go_cuenow({def,c}) {
        if (!this.cuenow?.buffer) return console.warn("!ModusCueletSeq.cuenow.buffer",this)
        this.zip = new Ziplet({orch:this.orch, mo:this, cuelet:this.cuenow})
        // crossfade from last
        if (c.fadein) {
            fadein(this.zip,c.fadein)
        }
        // play
        this.zip.start()

        this.plan_crossfade({def,c})
    }

    plan_crossfade({def,c}) {
        let cuenow = this.cuenow
        let cuenext = this.orch.next_cuelet(cuenow)
        let continuity = cuenext.in == cuenow.out
        

        if (!continuity) {
            // crossfading discontinuity, probably from looping
            // the next thing might not be buffered yet!
            let duration = source.buffer?.duration || 2000
            let left = duration - fadetime
            return console.log("Wanna comeback in "+left)
            
            setTimeout(() => {
                // this may occur after a cuelets[] rearrangement
                if (cuelet != cuenow) return console.warn("give up scheduleNextSound() control")
                // this will go back to [0] if no such cuenow
                cuenext = next_cuelet(cuenow)
                cuelet.source.fadeout(fadetime)
                needle.opacity.set(0,{duration:fadetime*1000})
                cuenow = cuenext
                def.comeback(0,{c:{fadein:fadetime}})
                // scheduleNextSound({fadein:fadetime})
            },left * 1000)
        }


        source.onended = () => {
            // if nobody else (crossfading, ~cuelets) has altered cuenow since we started
            // cuenext will already be cuenow|playing if crossfading
            if (this.cuenow == cuenow) {
                def.comeback(0,{c:{go:1}})
            }
        };
    }
}

let fadetime = 1.5
// some sound to play, and when
class Ziplet {
    public orch:Cueleter
    public mo:Modus

    public gain
    // in the Web Audio sense
    public source
    // .buffer comes from
    public cuelet
    public duration:number

    constructor({orch,mo,cuelet}) {
        this.orch = orch
        this.mo = mo
        // each ziplet fades into modus
        this.gain = this.orch.audioContext.createGain();
        this.gain.connect(this.mo.gain)

        // < input could also be the source file itself?
        cuelet && this.load_cuelet(cuelet)
    }
    // 1:1 with cuelet brings the buffer, duration
    // < and relativity to selection
    load_cuelet(cuelet) {
        this.cuelet = cuelet
        this.source = this.orch.audioContext.createBufferSource()
        this.source.buffer = this.cuelet.buffer
        this.duration = this.source.buffer.duration
        if (!this.duration) debugger
    }
    start(at) {
        let time = this.orch.audioContext.currentTime
        this.cuelet.startTime = time
        this.source.start(time);
    }
}

// these?
function fade(zip,sudden_val,thence_val,fadetime:number) {
    let time = zip.orch.audioContext.currentTime
    zip.gain.setValueAtTime(sudden_val, time);
    zip.gain.linearRampToValueAtTime(thence_val, time + fadetime);
}
function fadein(zip,fadetime) {
    fade(0,1,fadetime)
}
function fadeout(zip,fadetime) {
    fade(1,0,fadetime)
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