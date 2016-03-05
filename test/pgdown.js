'use strict'

const test = require('tape')
const common = require('./_common')
const util = require('../util')
const PgDOWN = require('../')

test('constructor', (t) => {
  t.test('defaults', (t) => {
    const db = PgDOWN(common.location())
    const config = db._config
    t.equal(config.database, util.PG_DEFAULTS.database, 'uses default database')
    t.equal(config._table.indexOf(common.PREFIX), 0, 'table name uses test prefix')
    t.ok(db._qname.indexOf(config._table) >= 0, 'qualified name includes table name')
    t.equal(config._schema, undefined, 'no schema')
    t.end()
  })
})

test('open', (t) => {
  t.test('empty location', (t) => {
    t.throws(() => PgDOWN(), 'location required')
    t.throws(() => new PgDOWN(), 'location required')
    t.end()
  })

  t.skip('invalid db name', (t) => {
    const database = 'pg_invalid_db__'
    const loc = common.location('/' + database + '/' + common.PREFIX)
    const db = PgDOWN(loc)
    t.equal(db._config.database, database, 'db name set')
    t.equal(db.location.indexOf(loc), 0, 'location set')

    db.open((err) => {
      t.ok(err, 'error on open')
      t.end()
    })
  })

  t.test('malformed table name', (t) => {
    const table = common.location('malformed_\0_table')
    const db = PgDOWN(table)
    t.equal(db._config._table, table, 'table name in config')

    db.open((err) => {
      t.ok(err, 'error on open')
      t.end()
    })
  })

  t.test('no create if missing', (t) => {
    const loc = common.location()
    const opts = { createIfMissing: false }

    const db = PgDOWN(loc)
    db.open(opts, (err) => {
      t.equal(db.location, loc, 'location set')
      t.ok(err, 'error on open')

      const db2 = PgDOWN(loc)
      db2.open(opts, (err) => {
        t.equal(db2.location, loc, 'location set')
        t.ok(err, 'error on open')

        t.end()
      })
    })
  })
})
