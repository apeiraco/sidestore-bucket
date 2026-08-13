set windows-shell := ["pwsh.exe", "-NoLogo", "-Command"]

setup:
    mise install
    mise exec -- pnpm install --frozen-lockfile
    mise exec -- prek install

# Query upstream releases without changing tracked files or downloading IPAs.
checkver *args:
    mise exec -- node scripts/bucket-cli.ts checkver {{args}}

# Download and verify changed IPAs, then update the lock and generated source.
update *args:
    mise exec -- node scripts/bucket-cli.ts update {{args}}

# Rebuild source and catalog offline from validated manifests and lock data.
build *args:
    mise exec -- node scripts/bucket-cli.ts build {{args}}

validate:
    mise exec -- node scripts/bucket-cli.ts validate

check:
    mise exec -- prek run --all-files

test:
    mise exec -- pnpm test

fmt:
    mise exec -- pnpm fmt

build-docs:
    mise exec -- pnpm docs:build

dev-docs:
    mise exec -- pnpm docs:dev

preview-docs:
    mise exec -- pnpm docs:preview

clean:
    mise exec -- node scripts/bucket-cli.ts clean
