type LoadDoneCallback = () => void;

class ImageCache {
  private readonly images = new Map<string, HTMLImageElement>();
  private loadingCount = 0;
  private callback: LoadDoneCallback|undefined;

  get(src: string) {
    let image = this.images.get(src);
    if (!image) {
      image = new Image();
      image.src = src;
      image.addEventListener('load', () => {
        this.loadingCount--;
        if (this.loadingCount === 0 && this.callback) {
          this.callback();
        }
      });
      this.images.set(src, image);
      this.loadingCount++;
    }
    return image;
  }

  setLoadDoneCallback(callback: LoadDoneCallback|undefined) {
    this.callback = callback;
  }
}

export const imageCache = new ImageCache();
