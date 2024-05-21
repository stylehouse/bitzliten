
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
