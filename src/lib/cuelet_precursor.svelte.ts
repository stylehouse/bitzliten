
import type { quadjustable, amode, amodes, adublet } from "./ff/FFgemp"
import { fetch } from "./ff/FFgemp"
export class Fili {
    public id
    public path:string

    public data = $state()
    public name = $state()
    constructor(opt) {
        Object.assign(this,opt)
    }
    async wake({onload}) {
        let fil = this
        if (fil.path && !fil.data) {
            let path = fil.path
            fil.data = await fetch(fil.path);
            onload && onload()
        }
        if (!fil.path) debugger
        // derive name from the end of path
        fil.name = fil.path.split("/").pop()
    }
}
export class Sele {
    public id
    public fil:Fili

    public in = $state()
    public out = $state()
    public playlets:adublet[] = $state([])
    public modes
    constructor(opt) {
        Object.assign(this,opt)
    }
    inout(opt) {
        this.in = opt.in
        this.out = opt.out
    }
}

export function create_unfulfilled_dublets(sel,n_chunks,chunk_length:number) :adublet[] {
    return Array(n_chunks).fill(1).map((v,k) => {
        return {
            sel,
            in: sel.in + k*chunk_length,
            out: sel.in + k*chunk_length + chunk_length,
        }
    })
}
