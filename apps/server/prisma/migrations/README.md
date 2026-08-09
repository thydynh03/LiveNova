# Migrations

Until now this project had no migrations at all. The schema was pushed with

```
prisma db push --accept-data-loss
```

which is the deploy step equivalent of `rm -rf` with a shrug: when a column is
renamed or narrowed, Postgres drops the old one and Prisma is told not to ask.
There was also no history, so there was no rollback and no way to prove that
staging and production had the same shape.

`00000000000000_init` is a baseline generated from the schema as it stood, with

```
prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

It has never been *run* against the existing databases — they already have these
tables. It exists so that every migration from here on has a known starting
point.

## Deploying

```bash
pnpm --filter @livenova/server prisma:deploy
```

## An existing database, once

A database created by `db push` already contains the baseline's tables, so
running it would fail on `CREATE TABLE ... already exists`. Mark it as applied
instead — once per environment, before the first real deploy:

```bash
pnpm --filter @livenova/server prisma:baseline
```

Then `prisma:deploy` from that point on.

## Rules

- `prisma migrate dev` on a developer machine to author a change. It writes a
  new folder here; commit it with the code that needs it.
- `prisma:deploy` in CI and production. Never `db push` there.
- `--accept-data-loss` has been removed from `prisma:push`. If a local push now
  refuses, that refusal is the point: it is telling you the change would destroy
  data, which is exactly what you need to know before writing the migration.
