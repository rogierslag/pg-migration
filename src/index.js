import fs from 'fs-extra'

// Promise polyfill for ES5 compatibility
require('es6-promise').polyfill()

function defaultLog(level, message) {
  const obj = {
    datetime: Date.now(),
    severity: level,
    message: message
  }
  console.log(JSON.stringify(obj))
}

const changesetExists = 'SELECT id FROM dbchangelog WHERE id=$1'

function migrateAndStart(databaseClient, migrationsDir, cb) {
  opts.log('info', 'Checking for migrations to perform')
  // Check whether we need to create the migration table itself
  databaseClient.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dbchangelog'")
    .then(res => {
      if (res.rowCount === 1) {
        migrate(databaseClient, migrationsDir, cb)
      } else {
        opts.log('info', 'Creating the migration table')
        return databaseClient.query('CREATE TABLE dbchangelog(id text, datetime timestamp with time zone);CREATE UNIQUE index changeset on dbchangelog(id);')
          .then(res => {
            opts.log('info', 'Created the migration table')
            migrate(databaseClient, migrationsDir, cb)
          })
          .catch(err => opts.log('error', `Could not create the migration table: ${err.message}`))
      }
    })
    .catch(err => opts.log('error', err.message))
}

function migrate(databaseClient, migrationsDir, cb) {
  fs.readdir(migrationsDir, (err, items) => {
    if (err) {
      // In case of an error while fetching the migrations, error and abort
      opts.log('warning', `Could not find changesets: ${err.message}`)
      return cb()
    }

    // Create promises for applying the changesets. Filter the README and dbchangelog.sql files
    const promise = items
      .filter(e => e.indexOf('README.md') === -1 && e.indexOf('dbchangelog.sql') === -1)
      .sort()
      .reduce((promise, changeset) => {
        return promise.then(() => {
          return new Promise((resolve, reject) => {
            const changesetCode = changeset.replace('.sql', '')
            opts.log('debug', `Checking whether to apply changeset ${changesetCode}`)
            return databaseClient.query(changesetExists, [changesetCode])
              .then(res => {
                if (res.rowCount === 1) {
                  // This changeset is already applied
                  opts.log('debug', `No need to apply changeset ${changesetCode}`)
                  return resolve()
                }

                opts.log('info', `Applying changeset ${changesetCode}`)
                // Read the file content
                const changesetContent = fs.readFileSync(`${migrationsDir}/${changeset}`, 'UTF-8')
                return databaseClient.query('BEGIN')
                  // Apply the changeset
                  .then(res => databaseClient.query(changesetContent))
                  // Save the value of the changeset to the database
                  .then(res => databaseClient.query('INSERT INTO dbchangelog (id, datetime) VALUES ($1, NOW())', [changesetCode]))
                  // Commit the changeset
                  .then(res => databaseClient.query('COMMIT'))
                  // Resolve
                  .then(res => {
                    opts.log('debug', `Finished applying changeset ${changesetCode}`)
                    resolve()
                  })
                  // Something bad happened
                  .catch(err => {
                    // Couldn't apply the changeset, probably an error in the migration. Reject the promise
                    opts.log('error', `Error applying the changeset ${changesetCode}: ${err}`)
                    reject(err)
                  })
              })
              .catch(err => {
                opts.log('error', err)
                reject(err)
              })
          })
        })
      }, Promise.resolve())

    promise
      .then(cb)
      .catch(err => {
        opts.log('error', 'One or more migrations failed to apply')
        cb(err)
      })
  })
}

const opts = {
  log: defaultLog
}

export default options => {
  Object.assign(opts, options)
  return migrateAndStart
}
