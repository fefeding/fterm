function copyText(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.select();
    try {
        return document.execCommand('copy');
    } catch {
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
}

export async function copy(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return copyText(text);
    }
}
