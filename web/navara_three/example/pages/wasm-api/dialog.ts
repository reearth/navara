export class FloatingDialog {
  private dialog: HTMLDivElement;
  private content: HTMLDivElement;

  constructor() {
    this.dialog = document.createElement("div");
    this.dialog.style.position = "absolute";
    this.dialog.style.backgroundColor = "#fff";
    this.dialog.style.padding = "10px";
    this.dialog.style.borderRadius = "8px";
    this.dialog.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.2)";
    // this.dialog.style.zIndex = '9999';
    this.dialog.style.minWidth = "100px";
    this.dialog.style.maxWidth = "80%";

    this.content = document.createElement("div");
    this.content.style.lineHeight = "1.4";
    this.dialog.appendChild(this.content);

    document.body.appendChild(this.dialog);

    this.hide();
  }

  updatePosition(x: number, y: number) {
    const height = 150;
    this.dialog.style.left = `${x}px`;
    this.dialog.style.top = `${y - height}px`;
  }

  hide() {
    this.dialog.style.display = "none";
  }

  show() {
    this.dialog.style.display = "block";
  }

  updateMessages(newMessages: string[]) {
    this.content.innerHTML = newMessages
      .map((line) => `<p style="margin: 4px 0;">${line}</p>`)
      .join("");
  }

  destroy() {
    if (this.dialog.parentElement) {
      this.dialog.parentElement.removeChild(this.dialog);
    }
  }
}
