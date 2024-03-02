'use strict'

/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const sinon = require('sinon')
const { JobWrk } = require('..')
const { promiseSleep: sleep } = require('@bitfinex/lib-js-util-promise')

describe('JobWrk tests', () => {
  const stateDir = path.join(__dirname, 'state')
  const statePath = path.join(stateDir, 'my-state.json')
  let wrk = null

  beforeEach(() => {
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath)
    if (fs.existsSync(stateDir)) fs.rmdirSync(stateDir)
  })

  after(() => {
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath)
    if (fs.existsSync(stateDir)) fs.rmdirSync(stateDir)
  })

  afterEach(() => {
    if (wrk) wrk.stop()
    sinon.reset()
  })

  describe('start tests', () => {
    it('should init state with empty object by default', () => {
      wrk = new JobWrk({ statePath })
      wrk.start()

      const fileContent = fs.readFileSync(statePath, { encoding: 'utf-8' })
      assert.deepStrictEqual(wrk.state, {})
      assert.strictEqual(fileContent, '{}')
    })

    it('should init state also only when directory exists', () => {
      fs.mkdirSync(stateDir)
      wrk = new JobWrk({ statePath })
      wrk.start()

      const fileContent = fs.readFileSync(statePath, { encoding: 'utf-8' })
      assert.deepStrictEqual(wrk.state, {})
      assert.strictEqual(fileContent, '{}')
    })

    it('should init state also when only directory exists', () => {
      fs.mkdirSync(stateDir)
      fs.writeFileSync(statePath, JSON.stringify({ foo: 'bar' }), { flag: 'w', encoding: 'utf-8' })
      wrk = new JobWrk({ statePath })
      wrk.start()

      assert.deepStrictEqual(wrk.state, { foo: 'bar' })
    })
  })

  describe('stop tests', () => {
    it('should store state', () => {
      wrk = new JobWrk({ statePath })
      wrk.start()
      wrk.state = { foo: 'bar' }
      wrk.stop()

      const fileContent = fs.readFileSync(statePath, { encoding: 'utf-8' })
      assert.deepStrictEqual(wrk.state, JSON.parse(fileContent))
    })

    it('should clear all jobs', () => {
      fs.mkdirSync(stateDir)
      wrk = new JobWrk({ statePath })
      wrk.start()

      const job = () => { }
      wrk.addJob('foo', job, 300)
      wrk.addJob('bar', job, 300)

      wrk.stop()

      assert.strictEqual(wrk._jobs.has('foo'), false)
      assert.strictEqual(wrk._jobs.has('bar'), false)
      assert.strictEqual(wrk._jobStates.has('foo'), false)
      assert.strictEqual(wrk._jobStates.has('bar'), false)
    })
  })

  describe('addJob tests', () => {
    it('should add a new job when it does not exist', async () => {
      wrk = new JobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = sinon.stub().callsFake(() => { })
      const res = wrk.addJob(key, job, 300)
      await sleep(500)

      assert.ok(res)
      assert.ok(job.calledOnce)
    }).timeout(3000)

    it('should not add a job when it already exists', async () => {
      wrk = new JobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = () => { }
      wrk.addJob(key, job, 300)
      const res = wrk.addJob(key, job, 500)

      assert.strictEqual(res, false)
    })

    it('should run job immediatelly when specified', async () => {
      wrk = new JobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = sinon.stub().callsFake(() => { })
      const res = wrk.addJob(key, job, 300, true)
      await sleep(500)

      assert.ok(res)
      assert.ok(job.calledTwice)
    }).timeout(3000)
  })

  describe('stopJob tests', () => {
    it('should remove a job when it exists', async () => {
      wrk = new JobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = () => { }
      wrk.addJob(key, job, 300)
      assert.strictEqual(wrk._jobs.has(key), true)
      assert.strictEqual(wrk._jobStates.has(key), true)

      const res = wrk.stopJob(key)

      assert.strictEqual(wrk._jobs.has(key), false)
      assert.strictEqual(wrk._jobStates.has(key), false)

      assert.ok(res, true)
    })

    it('should return false when job does not exist', async () => {
      wrk = new JobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const res = wrk.stopJob(key)

      assert.strictEqual(res, false)
    }).timeout(3000)
  })

  describe('job run tests', () => {
    it('inteval should not start a new job when an existing job is running', async () => {
      wrk = new JobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = sinon.stub().callsFake(() => sleep(700))
      wrk.addJob(key, job, 300)

      assert.strictEqual(wrk._jobStates.get(key).running, false)
      await sleep(500)
      assert.strictEqual(wrk._jobStates.get(key).running, true)
      await sleep(600)
      assert.strictEqual(wrk._jobStates.get(key).running, false)

      assert.ok(job.calledOnce)
    }).timeout(3000)
  })
})
