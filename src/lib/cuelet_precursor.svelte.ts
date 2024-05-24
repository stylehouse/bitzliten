
import type { quadjustable, amode, amodes, adublet } from "./ff/FFgemp"
import { fetch, getSHA256HashOfUint8Array } from "./ff/FFgemp"
type fil_type = 'audio'|'video'|'image'
export class Fili {
    public id
    // URL or file upload
    public path:string
    public file:File

    public data = $state()
    public dig:string = $state()
    public type:fil_type
    public name = $state()

    constructor(opt) {
        Object.assign(this,opt)
    }
    async wake({onload}) {
        let fil = this
        if (!fil.data) {
            // either a string URI path or File object

            if (fil.path) {
                fil.data = await fetch(fil.path);
                // derive name from the end of path
                fil.name = fil.path.split("/").pop()
            }
            if (fil.file) {
                fil.data = await fetch(fil.file);
                // it comes knowing these
                if (!fil.file.type || !fil.file.name) debugger
                fil.name = fil.file.name
                fil.type = fil.file.type.split('/').shift()
            }
            fil.dig = await getSHA256HashOfUint8Array(fil.data)
            onload && onload()
        }
    }
}
export class Sele {
    public id
    public fil:Fili

    public in = $state()
    public in_inclusive = $state()
    public out = $state()
    public out_inclusive = $state()
    public playlets:adublet[] = $state([])
    public modes
    constructor(opt) {
        Object.assign(this,opt)
    }
    inout(opt) {
        this.in = opt.in
        this.out = opt.out
    }

    // has .on_reselection and .chunk_length
    public enc
    // receives fast and fine time adjustments
    on_adjust(finely) {
        this.in = finely.in
        this.out = finely.out
        // inclusively select dublet spaces
        let fel = this.inclusivise()
        if (fel.in != this.in_inclusive || fel.out != this.out_inclusive) {
            // non-reactively set it here
            this.in_inclusive = fel.in
            this.out_inclusive = fel.out
            console.log("Selection Woke",fel)
            // then cause a reaction
            this.enc.on_reselection()
        }
        else {
            // console.log("Selection zzzz",sel)
        }
    }
    // round to cuelet edge
    inclusivise() {
        let chunk_length = this.enc.chunk_length
        return {
            in: Math.floor(this.in / chunk_length) * chunk_length,
            out: Math.ceil(this.out / chunk_length) * chunk_length,
        }
    }
    // generate a bunch of tiles for your ears to walk on
    make_playlets():adublet[] {
        // how to encode (modes)
        this.modes = clone_modes(this.enc.modes)
        // and attaches the Fili's identity
        if (!this.fil.dig) debugger
        set_modes_value(this.modes,'input',this.fil.name+"#"+this.fil.dig)

        // a set of dublets stretching across it
        let nublets = this.create_unfulfilled_dublets()
        // ready it for being an ffmpeg job
        //  ie include modes+modes_json, which includes its in|out points
        nublets.map(nublet => {
            nublet.sel = this
            // inherit how to do things
            nublet.modes = clone_modes(this.modes)
            // narrow in|out to this nublet
            sel_to_modes(nublet,nublet.modes)
            // this now describes a unique dublet
            nublet.modes_json = JSON.stringify(nublet.modes)
        })
        nublets.map(nublet => {
            // console.log(`nublet ${nublet.in}: ${this.fil.name}`)
        })
        // link to candidate dublets
        nublets.map(nublet => this.find_dub(nublet))

        // and we now call that
        return nublets
    }
    create_unfulfilled_dublets():adublet[] {
        let {n_chunks,chunk_length} = this.get_timespace()
        let begins = this.in_inclusive
        if (begins == null) debugger
        return Array(n_chunks).fill(1).map((v,k) => {
            return {
                in: begins + k*chunk_length,
                out: begins + k*chunk_length + chunk_length,
            }
        })
    }
    // playlet // dublet
    find_dub(nublet) {
        // try to match the whole of modes
        let ideal = this.enc.dublets.find(
            dublet => dublet.modes_json == nublet.modes_json
        )
        if (ideal) {
            nublet.ideal_dub = ideal
        }
        else {
            // settle for any playable instance of that time
            //  for Player to prefer an out-moded bitrate over dead air
            let vague = this.enc.dublets.find(
                dublet => dublet.in == nublet.in && dublet.out == nublet.out
                    && dublet.sel.fil == nublet.sel.fil
            )
            if (vague) {
                nublet.vague_dub = vague
            }
        }
    }
    get_timespace() {
        // we have a notch
        let length = this.out - this.in
        if (isNaN(length)) throw "NaN"
        // < redundant?
        if (length < 0)
            this.out = this.in + 4
        // < wind down if this.out is > file length
        let chunk_length = this.enc.chunk_length

        // < blog on this convention
        let n_chunks = Math.ceil(length / chunk_length)
        return {length,n_chunks,chunk_length}
    }
}


    function clone_modes(these) {
        // < why not?
        // return modes.map(mode => Object.fromEntries(mode))
        return these.map(mode => {
            let ha = {...mode}
            return ha
        })
    }
    // sel -> modes
    // called from letsgo(), so we have modes[]
    type sel_basically = {in,out}
    function sel_to_modes(sel:sel_basically,modes) {
        set_modes_value(modes,'seek',sel.in)
        let length = sel.out - sel.in
        if (length <= 0) throw "!length"
        set_modes_value(modes,'length',length)
    }
    function set_modes_value(modes,t,s) {
        if (s == null) throw "huh"
        let mode = find_t_in_N(modes,t)
        mode.s = s
    }
    function find_t_in_N(N,t) {
        let M = N.filter((m) => m.t == t)
        if (M.length > 1) throw "many t"
        return M[0]
    }

