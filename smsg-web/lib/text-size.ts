// ADR-037: runs before paint. Its sha256 is allowed in the private CSP (ADR-036): never edit without care.
export const TEXT_SIZE_SCRIPT = `try{var s=localStorage.getItem("text-size");if(s==="l"||s==="xl")document.documentElement.dataset.textSize=s}catch(e){}`;
