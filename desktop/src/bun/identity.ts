/**
 * The one name the operating system knows this app by.
 *
 * It was written out twice — once for the keychain service and once for the
 * directory under Application Support — and two copies of a name that has to
 * match is one copy too many: a rename would have moved the window's preferences
 * and quietly left the reader's token behind under the old service.
 *
 * The same string as `app.identifier` in `electrobun.config.ts`, which the build
 * reads and the runtime does not hand back.
 */
export const IDENTIFIER = "dev.gitquiet.app"
