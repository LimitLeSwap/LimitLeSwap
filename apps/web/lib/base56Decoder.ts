export default function base58Decode(input: string): number {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const base = BigInt(58);
  let result = BigInt(0);

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const index = alphabet.indexOf(char);

    if (index === -1) {
      throw new Error(`Invalid Base58 character '${char}' at position ${i}`);
    }

    result = result * base + BigInt(index);
  }

  return Number(result % BigInt(Number.MAX_SAFE_INTEGER));
}
