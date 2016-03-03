'use strict'

const inherits = require('inherits')
const AbstractChainedBatch = require('abstract-leveldown/abstract-chained-batch')
const debug = require('debug')('pgdown')
const debugv = require('debug')('pgdown:verbose')

function PgChainedBatch (db) {
  debug('# PgChainedBatch (db)')

  AbstractChainedBatch.call(this, db)

  this._qname = db._qname

  this._client = db._connect().then((client) => {
    client.query('BEGIN')
    return client
  })

  // ensure cleanup for initialization errors
  this._client.catch((err) => {
    debug('_chainedBatch initialization error: %j', err)
    this._cleanup(err)
  })
}

inherits(PgChainedBatch, AbstractChainedBatch)

PgChainedBatch.prototype._write = function (cb) {
  this._cb = cb
  this._client.then((client) => {
    client.query('COMMIT', (err) => this._cleanup(err, cb))
  })
  .catch((err) => this._cleanup(err, cb))
}

PgChainedBatch.prototype._put = function (key, value) {
  debugv('# PgChainedBatch _put (key = %j, value = %j)', key, value)

  this._client.then((client) => {
    const op = { type: 'put', key: key, value: value }
    PgChainedBatch._commands.put(client, this._qname, op)
  })
  .catch((err) => this._cleanup(err))
}

PgChainedBatch.prototype._del = function (key) {
  debugv('# PgChainedBatch _del (key = %j)', key)

  this._client.then((client) => {
    const op = { type: 'del', key: key }
    PgChainedBatch._commands.del(client, this._qname, op)
  })
  .catch((err) => this._cleanup(err))
}

PgChainedBatch.prototype._clear = function () {
  debug('# PgChainedBatch _clear ()')
  this._client.then((client) => {
    // abort existing transaction and start a fresh one
    client.query('ROLLBACK')
    client.query('BEGIN')
  })
  .catch((err) => this._cleanup(err))
}

PgChainedBatch.prototype._cleanup = function (err, cb) {
  const result = this._client.then((client) => {
    // NB: for now, always destroy client
    client.release(true) // client.release(err)
    if (cb) cb(err || null)
  })

  if (cb) result.catch(cb)
}

PgChainedBatch._commands = {}

PgChainedBatch._commands.put = function (client, qname, op, cb) {
  const INSERT = `INSERT INTO ${qname} (key,value) VALUES($1,$2)`
  const UPSERT = INSERT + ' ON CONFLICT (key) DO UPDATE SET value=excluded.value'
  // const UPDATE = `UPDATE ${qname} SET value=($2) WHERE key=($1)'`

  // always an upsert for now
  const command = UPSERT
  const params = [ op.key, op.value ]
  debugv('put command: %s %j', command, params)

  return client.query(command, params, cb)
}

PgChainedBatch._commands.del = function (client, qname, op, cb) {
  const command = `DELETE FROM ${qname} WHERE (key) = $1`
  const params = [ op.key ]
  debugv('del command: %s %j', command, params)

  return client.query(command, params, cb)
}

module.exports = PgChainedBatch