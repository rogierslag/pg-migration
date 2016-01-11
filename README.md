# pg-migration

## What is it?

NodeJS lacks support for good proper ORMs, and most ORMs tend to suck a bit in the end anyway.
For [inventid](https://www.inventid.nl) I therefore developed this simple nodejs version for postgresql of [Liquibase](http://www.liquibase.org/).
It is based on the excellent [node-postgres](https://github.com/brianc/node-postgres) library.

## The database changelog table

Before you can use this, ensure the database has at least one table.
You will need the following SQL for this

```sql
CREATE TABLE dbchangelog(id bigint, datetime timestamp with time zone);
CREATE UNIQUE index changeset on dbchangelog(id);
```

## How to use

1. Import the library `import migrateAndStart from 'pg-migration';`
1. Create a valid database client connection
1. Create the migration, with that client, and a callback to the server start (e.g. `migrateAndStart(db, './migrations', startServer);`)

Files called `README.md` and `dbchangelog.sql` from the migrations folder are ignored.

Since the changeset id is derived from the file name, you can use the following command to create a new one `touch `date +%Y%m%d%H%M%S`.sql`.
Please be careful that the files will be executed in a alphabetically sorted fashion, so ensure that files do not depend on anything later (it's really a poor mans Liquibase).
