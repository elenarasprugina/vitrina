/* Звук взятой в запись вкладки. Собираем по 1024 отсчёта, чтобы не нагружать панель сообщениями. */
class FilmAudioCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 1024;
    this.used = 0;
    this.left = new Float32Array(this.size);
    this.right = new Float32Array(this.size);
    this.quantum = 128;
    this.running = true;
    this.port.onmessage = ({ data }) => {
      if (data === 'stop' || data === 'flush') this.running = false;
      if (data === 'flush') {
        this.send();
        this.port.postMessage({ flushed: true });
      }
    };
  }

  send() {
    if (!this.used) return;
    this.port.postMessage({
      start: this.start, left: this.left.subarray(0, this.used), right: this.right.subarray(0, this.used)
    }, [this.left.buffer, this.right.buffer]);
    this.left = new Float32Array(this.size);
    this.right = new Float32Array(this.size);
    this.used = 0;
  }

  process(inputs) {
    if (!this.running) return false;
    const input = inputs[0];
    const left = input && input[0], right = input && (input[1] || left);
    if (left) this.quantum = left.length;
    for (let i = 0; i < this.quantum; i++) {
      if (!this.used) this.start = currentFrame + i;
      this.left[this.used] = left ? left[i] : 0;
      this.right[this.used++] = right ? right[i] : 0;
      if (this.used === this.size) this.send();
    }
    return true;
  }
}

registerProcessor('m13-film-audio', FilmAudioCapture);
