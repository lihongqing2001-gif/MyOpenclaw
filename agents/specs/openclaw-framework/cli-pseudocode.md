# CLI Pseudocode (v0.2)

## install <capability-id>
```
resolve(id):
  meta = registry.get(id)
  ensure version + checksum
  deps = meta.dependencies
  for dep in deps:
    if !installed(dep):
      fail("missing dependency: " + dep)

  pkg = download(meta.download_url)
  verify(pkg.checksum)
  unpack(pkg, ~/.openclaw/capabilities/<id>/<version>)
  run(pkg.install)
  run(pkg.healthcheck)
  record_install(id, version, checksum, status=ready)
```

## update <capability-id>
```
current = installed(id)
latest = registry.get(id)
if latest.version == current.version: exit
backup(current)
install(latest)
if fail: rollback(current)
```

## verify <capability-id>
```
run healthcheck
return status
```
