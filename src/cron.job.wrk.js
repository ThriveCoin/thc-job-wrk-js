'use strict'

const schedule = require('node-schedule')

const JobWrk = require('./job.wrk')

/**
 * @typedef CronJobState
 * @property {boolean} running
 * @property {string} interval
 */

class CronJobWrk extends JobWrk {
  start () {
    super.start()

    /** @type {Map<string, schedule.Job>} */
    this._cronJobs = new Map()
    /** @type {Map<string, CronJobState>} */
    this._cronJobStates = new Map()
  }

  stop () {
    const cronJobKeys = []
    for (const key of this._cronJobs.keys()) {
      cronJobKeys.push(key)
    }
    cronJobKeys.forEach(key => this.stopCronJob(key))

    super.stop()
  }

  /**
   * @param {string} key
   * @param {() => Promise<void>} task
   * @param {string} interval
   * @param {boolean} [immediate]
   */
  addCronJob (key, task, interval, immediate = false) {
    if (this._cronJobs.has(key)) return false

    this._cronJobStates.set(key, { running: false, interval })

    const job = async () => {
      const jobState = this._cronJobStates.get(key)
      if (jobState?.running) return
      jobState.running = true

      try {
        await task()
      } catch (err) {
        // do nothing
      } finally {
        jobState.running = false
      }
    }

    this._cronJobs.set(key, schedule.scheduleJob(interval, job))

    if (immediate) this._cronJobs.get(key).invoke()

    return true
  }

  /**
   * @param {string} key
   */
  stopCronJob (key) {
    if (!this._cronJobs.has(key)) return false

    this._cronJobs.get(key).cancel(false)
    this._cronJobs.delete(key)
    this._cronJobStates.delete(key)

    return true
  }
}

module.exports = CronJobWrk
