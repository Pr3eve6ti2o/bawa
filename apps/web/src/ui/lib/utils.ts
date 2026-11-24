import { type ClassValue, clsx } from 'clsx'

// Lane C (token-verify programme): tailwind-merge was removed (25,958
// bytes). cn() is now a plain clsx join — it does NOT resolve
// conflicting Tailwind classes. The ui components were restructured so
// no call site passes a class that conflicts with the component's own
// classes: overrides are props now (Button size/variant, Card
// radius/tone/borderTone/padding, CardHeader padding/gap, Input
// radius/height/width, Label weight). Do not pass a conflicting class
// via className — with a plain join the stylesheet order would decide
// the winner, not the call site.
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
