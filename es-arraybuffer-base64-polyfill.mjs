Uint8Array.fromHex ??= function (string) {
  return Uint8Array.from({ length: string.length / 2 }, (_, id) => parseInt(string.substring(id * 2, (id + 1) * 2), 16));
}

Uint8Array.prototype.toHex ??= function toHex() {
  return Array.from(this, byte => byte.toString(16).padStart(2, '0')).join('')
};
