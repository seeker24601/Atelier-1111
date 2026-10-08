// Closing the parent pipe also stops the backend after an unexpected shell exit.
process.stdin.resume()
process.stdin.on('end', () => process.exit(0))
process.argv.push('--app')
await import('../server/index.js')
