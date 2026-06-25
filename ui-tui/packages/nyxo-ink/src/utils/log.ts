export function logError(error: unknown): void {
  if (!process.env.NYXO_INK_DEBUG_ERRORS) {
    return
  }

  console.error(error)
}
