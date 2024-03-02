'use strict'

const fs = require('fs')
const path = require('path')

/**
 * @typedef JobState
 * @property {boolean} running
 * @property {number} interval
 */

class JobWrk {
  /**
   * @param {Object} params
   * @param {string} params.statePath
   */
  constructor (params) {
    this._statePath = params.statePath
  }

  start () {
    this._loadState()

    /** @type {Map<string, NodeJS.Timeout>} */
    this._jobs = new Map()
    /** @type {Map<string, JobState>} */
    this._jobStates = new Map()
  }

  stop () {
    const jobKeys = []
    for (const key of this._jobs.keys()) {
      jobKeys.push(key)
    }
    jobKeys.forEach(key => this.stopJob(key))

    this._saveState()
  }

  _saveState () {
    const data = JSON.stringify(this.state)
    fs.writeFileSync(this._statePath, data, { flag: 'w', encoding: 'utf-8' })
  }

  _loadState () {
    const stateDir = path.dirname(this._statePath)
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true })
    }

    if (!fs.existsSync(this._statePath)) {
      this.state = {}
      return this._saveState()
    }

    this.state = JSON.parse(fs.readFileSync(this._statePath, { encoding: 'utf-8' }))
  }

  /**
   * @param {string} key
   * @param {() => Promise<void>} task
   * @param {number} interval
   * @param {boolean} [immediate]
   */
  addJob (key, task, interval, immediate = false) {
    if (this._jobs.has(key)) return false

    this._jobStates.set(key, { running: false, interval })

    const job = async () => {
      const jobState = this._jobStates.get(key)
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

    this._jobs.set(key, setInterval(job, interval))

    if (immediate) job()

    return true
  }

  /**
   * @param {string} key
   */
  stopJob (key) {
    if (!this._jobs.has(key)) return false

    clearInterval(this._jobs.get(key))
    this._jobs.delete(key)
    this._jobStates.delete(key)

    return true
  }
}

module.exports = JobWrk
