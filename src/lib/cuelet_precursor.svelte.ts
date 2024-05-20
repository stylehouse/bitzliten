
import type { quadjustable, amode, amodes, adublet } from "./ff/FFgemp"

export class Sele {
    public id
    public in = $state()
    public out = $state()
    public playlets:adublet[] = $state([])
    public modes
    constructor(opt) {
        this.id = opt.id
    }
    inout(opt) {
        this.in = opt.in
        this.out = opt.out
    }
}

export function create_unfulfilled_dublets(sel,n_chunks,chunk_length:number) :adublet[] {
    return Array(n_chunks).fill(1).map((v,k) => {
        return {
            in: sel.in + k*chunk_length,
            out: sel.in + k*chunk_length + chunk_length,
        }
    })
}
