// Meta keys that are device-local: they describe THIS device's backup setup or
// transient status and must never travel inside a portable backup.
//
// `autoBackupDirHandle` is a FileSystemDirectoryHandle — it serialises to `{}`
// through JSON, and a folder handle is meaningless on another device/install
// anyway. Worse, a restored `{}` reads back as truthy, so getBackupDirHandle()
// hands runAutoBackup a dead handle that silently fails. The last-success /
// last-error status keys are likewise per-device and not worth transplanting.
//
// exportAll() filters these out so a restore can't plant a dead handle or stale
// status. The portable auto-backup *preferences* (enabled, retention days) stay
// in the backup; without a folder the app simply prompts to re-pick one.
export const DEVICE_LOCAL_META_KEYS: ReadonlySet<string> = new Set([
  'autoBackupDirHandle',
  'autoBackupLastSuccess',
  'autoBackupLastError'
]);
