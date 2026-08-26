export function pushDrawer(stack, name) {
  return [...stack.filter((item) => item !== name), name];
}

export function popDrawer(stack) {
  if (!stack.length) return { stack: [], closed: null, active: null };
  const nextStack = stack.slice(0, -1);
  return {
    stack: nextStack,
    closed: stack[stack.length - 1],
    active: nextStack[nextStack.length - 1] ?? null,
  };
}

export function getFocusTrapTarget(count, activeIndex, shiftKey) {
  if (count <= 0) return -1;
  if (activeIndex < 0 || activeIndex >= count) return shiftKey ? count - 1 : 0;
  if (shiftKey) return activeIndex === 0 ? count - 1 : activeIndex - 1;
  return activeIndex === count - 1 ? 0 : activeIndex + 1;
}
