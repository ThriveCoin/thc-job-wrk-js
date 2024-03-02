'use strict'

const schedule = require('node-schedule')

const JobWrk = require('./job.wrk')

class CronJobWrk extends JobWrk {
  start () {
    super.start()

    /** @type {Map<string, schedule.Job>} */
    this._cronJobs = new Map()
    /** @type {Map<string, string>} */
    this._cronJobItvs = new Map()
    /** @type {Map<string, boolean>} */
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

    this._cronJobStates.set(key, false)

    const job = async () => {
      if (this._cronJobStates.get(key)) return
      this._cronJobStates.set(key, true)

      try {
        await task()
      } catch (err) {
        // do nothing
      } finally {
        this._cronJobStates.set(key, false)
      }
    }

    this._cronJobs.set(key, schedule.scheduleJob(interval, job))
    this._cronJobItvs.set(key, interval)

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
    this._cronJobItvs.delete(key)
    this._cronJobStates.delete(key)

    return true
  }
}

module.exports = CronJobWrk
