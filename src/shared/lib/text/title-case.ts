export const toTitleCase = (value: string) =>
  value.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_match, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`
  })
