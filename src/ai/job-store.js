import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJson } from './utils.js';

export class GenerationJobStore {
  constructor(directory, state) {
    this.directory = directory;
    this.statePath = path.join(directory, 'state.json');
    this.state = state;
  }

  static async create(rootDirectory, initial) {
    const id = `${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
    const directory = path.join(rootDirectory, id);
    await fs.promises.mkdir(directory, { recursive: false });
    const state = {
      schemaVersion: 'niv.generation-job/1',
      id,
      status: 'initializing',
      phase: 'capability-audit',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      remoteJobId: null,
      ...initial
    };
    const store = new GenerationJobStore(directory, state);
    await store.save();
    return store;
  }

  static async open(jobPath) {
    const statePath = path.basename(jobPath).toLowerCase() === 'state.json' ? jobPath : path.join(jobPath, 'state.json');
    const state = await readJson(statePath);
    return new GenerationJobStore(path.dirname(statePath), state);
  }

  async save() {
    this.state.updatedAt = new Date().toISOString();
    await writeJson(this.statePath, this.state);
  }

  async update(patch) {
    this.state = { ...this.state, ...patch, updatedAt: new Date().toISOString() };
    await this.save();
    return this.state;
  }

  async fail(error) {
    return this.update({
      status: 'failed',
      phase: 'failed',
      error: { name: error.name, code: error.code ?? 'UNEXPECTED_ERROR', message: error.message, details: error.details ?? null }
    });
  }
}
