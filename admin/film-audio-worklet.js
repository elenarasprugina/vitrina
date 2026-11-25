/* Звук взятой в запись вкладки. Собираем по 1024 отсчёта, чтобы не нагружать панель сообщениями. */
class FilmAudioCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 1024;
    this.used = 0;
    this.left = new Float32Array(this.size);
    this.right = new Float32Array(this.size);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) {
      this.used = 0;
      return true;
    }
    const left = input[0], right = input[1] || left;
    for (let i = 0; i < left.length; i++) {
      if (!this.used) this.start = currentFrame + i;
      this.left[this.used] = left[i];
      this.right[this.used++] = right[i];
      if (this.used === this.size) {
        this.port.postMessage({ start: this.start, left: this.left, right: this.right }, [this.left.buffer, this.right.buffer]);
        this.left = new Float32Array(this.size);
        this.right = new Float32Array(this.size);
        this.used = 0;
      }
    }
    return true;
  }
}

registerProcessor('m13-film-audio', FilmAudioCapture);
