export async function toBlobURL(url, mimeType) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const blob = await response.arrayBuffer();
        return URL.createObjectURL(new Blob([blob], { type: mimeType }));
    } catch (err) {
        console.error(`Error loading ${url}: ${err.message}`);
        throw err;
    }
}



export const atob = (b64) => Buffer.from(b64, "base64").toString("binary");

const readFromBlobOrFile = (blob) => new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.onload = () => {
        const { result } = fileReader;
        if (result instanceof ArrayBuffer) {
            resolve(new Uint8Array(result));
        }
        else {
            resolve(new Uint8Array());
        }
    };
    fileReader.onerror = (event) => {
        reject(Error(`File could not be read! Code=${event?.target?.error?.code || -1}`));
    };
    fileReader.readAsArrayBuffer(blob);
});
export const fetchFile = async (file) => {
    let data;
    if (typeof file === "string") {
        /* From base64 format */
        if (/data:_data\/([a-zA-Z]*);base64,([^"]*)/.test(file)) {
            data = atob(file.split(",")[1])
                .split("")
                .map((c) => c.charCodeAt(0));
            /* From remote server/URL */
        }
        else {
            data = await (await fetch(file)).arrayBuffer();
        }
    }
    else if (data instanceof Uint8Array) {
        return data
    }
    else if (file instanceof URL) {
        data = await (await fetch(file)).arrayBuffer();
    }
    else if (file instanceof File || file instanceof Blob) {
        data = await readFromBlobOrFile(file);
    }
    else {
        return new Uint8Array();
    }
    return new Uint8Array(data);
};