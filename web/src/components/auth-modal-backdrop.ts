export function shouldCloseAuthModalFromClick(
  target: EventTarget | null,
  currentTarget: EventTarget | null,
) {
  return target === currentTarget;
}
