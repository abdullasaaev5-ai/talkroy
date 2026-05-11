export function privateChatId(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `private_${x}_${y}`;
}
