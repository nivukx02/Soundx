export class MusicGenerationProvider {
  static adapterId = 'abstract/0';

  async capabilities() { throw new Error('capabilities() is not implemented'); }
  async generate(_plan, _inputs = {}) { throw new Error('generate() is not implemented'); }
  async transform(_plan, _source, _stems = []) { throw new Error('transform() is not implemented'); }
  async status(_jobId) { throw new Error('status() is not implemented'); }
  async cancel(_jobId) { throw new Error('cancel() is not implemented'); }
  async collect(_jobId) { throw new Error('collect() is not implemented'); }
  async analyze(_audioPath, _plan) { throw new Error('analyze() is not implemented'); }
  async reviewOriginality(_audioPath, _sourcePath, _plan) { throw new Error('reviewOriginality() is not implemented'); }

  publicConfiguration() { return { adapter: this.constructor.adapterId }; }
}
