'use strict'

/* eslint-env mocha */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const sinon = require('sinon')
const { CronJobWrk } = require('..')
const { promiseSleep: sleep } = require('@bitfinex/lib-js-util-promise')

describe('CronJobWrk tests', () => {
  const stateDir = path.join(__dirname, 'state')
  const statePath = path.join(stateDir, 'my-cron-state.json')
  let wrk = null

  beforeEach(() => {
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath)
    if (fs.existsSync(stateDir)) fs.rmdirSync(stateDir)
  })

  after(() => {
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath)
    if (fs.existsSync(stateDir)) fs.rmdirSync(stateDir)
  })

  describe('start tests', () => {
    it('should call parent start and init cron job props', () => {
      wrk = new CronJobWrk({ statePath })
      wrk.start()

      assert.deepStrictEqual(wrk.state, {})
      assert.ok(typeof wrk._cronJobs, Map)
      assert.ok(typeof wrk._cronJobItvs, Map)
      assert.ok(typeof wrk._cronJobStates, Map)
    })
  })

  describe('stop tests', () => {
    it('should clear all jobs, cron jobs and also store state', () => {
      fs.mkdirSync(stateDir)
      wrk = new CronJobWrk({ statePath })
      wrk.state = { foo: 'bar' }
      wrk.start()

      const job = () => { }
      wrk.addJob('foo', job, 300)
      wrk.addCronJob('bar', job, '*/2 * * * * *')

      wrk.stop()

      assert.strictEqual(wrk._jobs.has('foo'), false)
      assert.strictEqual(wrk._cronJobs.has('bar'), false)
      assert.strictEqual(wrk._jobStates.has('foo'), false)
      assert.strictEqual(wrk._cronJobItvs.has('bar'), false)
      assert.strictEqual(wrk._cronJobStates.has('bar'), false)

      const fileContent = fs.readFileSync(statePath, { encoding: 'utf-8' })
      assert.deepStrictEqual(wrk.state, JSON.parse(fileContent))
    })
  })

  describe('addCronJob tests', () => {
    afterEach(() => {
      if (wrk) wrk.stop()
      sinon.reset()
    })

    it('should add a new job when it does not exist', async () => {
      wrk = new CronJobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = sinon.stub().callsFake(() => { })
      const res = wrk.addCronJob(key, job, '*/4 * * * * *')
      await sleep(4000)

      assert.strictEqual(wrk._cronJobs.has(key), true)
      assert.strictEqual(wrk._cronJobItvs.has(key), true)
      assert.strictEqual(wrk._cronJobStates.has(key), true)

      assert.ok(res)
      assert.strictEqual(job.callCount, 1)
    }).timeout(7000)

    it('should not add a job when it already exists', async () => {
      wrk = new CronJobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = () => { }
      wrk.addCronJob(key, job, '* * * * * *')
      const res = wrk.addCronJob(key, job, '*/5 * * * * *')

      assert.strictEqual(res, false)
    })

    it('should run job immediatelly when specified', async () => {
      wrk = new CronJobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = sinon.stub().callsFake(() => { })
      const res = wrk.addCronJob(key, job, '* * * * * *', true)
      await sleep(1300)

      assert.ok(res)
      assert.ok(job.callCount >= 2)
      assert.ok(job.callCount <= 3) // depending on run time 2 intervals might be invoked
    }).timeout(3000)
  })

  describe('job run tests', () => {
    afterEach(() => {
      if (wrk) wrk.stop()
      sinon.reset()
    })

    it('inteval should not start a new job when an existing job is running', async () => {
      wrk = new CronJobWrk({ statePath })
      wrk.start()

      const key = 'my-job'
      const job = sinon.stub().callsFake(() => sleep(2000))
      wrk.addCronJob(key, job, '* * * * * *')

      assert.strictEqual(wrk._cronJobStates.get(key), false)
      await sleep(1300)
      assert.strictEqual(wrk._cronJobStates.get(key), true)
      await sleep(2000)

      assert.ok(job.calledOnce)
    }).timeout(7000)
  })
})
