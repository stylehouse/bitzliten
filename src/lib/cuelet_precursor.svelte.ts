
import type { quadjustable, amode, amodes, adublet } from "./ff/FFgemp"

export function create_unfulfilled_dublets(sel,n_chunks,chunk_length:number) :adublet[] {
    return Array(n_chunks).fill(1).map((v,k) => {
        return {
            in: sel.in + k*chunk_length,
            out: sel.in + k*chunk_length + chunk_length,
        }
    })
}
